import { PostedScheduleStatus, Role, WorkforceTrack } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { AppError, jsonError } from "@/lib/errors";
import { requireRole } from "@/lib/rbac";
import { optimizeScheduleFromAvailability } from "@/lib/schedule/optimize";
import {
  WORK_HOURS,
  currentWindowStart,
  dayKey,
  parseDayKey,
  trackFromRole,
  windowDays,
} from "@/lib/schedule/window";

function resolveTrack(userRole: Role, requested?: string | null): WorkforceTrack {
  if (userRole === Role.ADMIN) {
    if (requested === "TECH" || requested === "SALES") return requested;
    throw new AppError("Admin must pass track=TECH or track=SALES", 400);
  }
  const t = trackFromRole(userRole);
  if (!t) throw new AppError("Forbidden", 403);
  return t;
}

export async function GET(req: Request) {
  try {
    const user = await requireRole(Role.TECH, Role.SALES, Role.ADMIN);
    const url = new URL(req.url);
    const track = resolveTrack(user.role, url.searchParams.get("track"));
    const windowStart = currentWindowStart();

    const schedule = await prisma.schedulePeriod.findUnique({
      where: { track_windowStart: { track, windowStart } },
      include: {
        entries: {
          include: { user: { select: { id: true, name: true, email: true } } },
          orderBy: [{ day: "asc" }, { hour: "asc" }],
        },
        createdBy: { select: { name: true } },
      },
    });

    if (user.role !== Role.ADMIN) {
      const posted =
        schedule?.status === PostedScheduleStatus.POSTED
          ? {
              ...schedule,
              entries: schedule.entries.filter((e) => e.userId === user.id),
            }
          : null;
      return Response.json({
        track,
        windowStart: windowStart.toISOString(),
        days: windowDays(windowStart).map(dayKey),
        hours: [...WORK_HOURS],
        schedule: posted,
      });
    }

    return Response.json({
      track,
      windowStart: windowStart.toISOString(),
      days: windowDays(windowStart).map(dayKey),
      hours: [...WORK_HOURS],
      schedule,
    });
  } catch (err) {
    return jsonError(err);
  }
}

const adminSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("auto"),
    track: z.enum(["TECH", "SALES"]),
  }),
  z.object({
    action: z.literal("post"),
    track: z.enum(["TECH", "SALES"]),
  }),
  z.object({
    action: z.literal("reopen"),
    track: z.enum(["TECH", "SALES"]),
  }),
  z.object({
    action: z.literal("setEntry"),
    track: z.enum(["TECH", "SALES"]),
    userId: z.string().min(1),
    day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    hour: z.number().int().min(8).max(17),
    note: z.string().max(200).optional().nullable(),
  }),
  z.object({
    action: z.literal("removeEntry"),
    track: z.enum(["TECH", "SALES"]),
    userId: z.string().min(1),
    day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    hour: z.number().int().min(8).max(17),
  }),
  z.object({
    action: z.literal("clear"),
    track: z.enum(["TECH", "SALES"]),
  }),
]);

export async function POST(req: Request) {
  try {
    const admin = await requireRole(Role.ADMIN);
    const parsed = adminSchema.safeParse(await req.json());
    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0]?.message ?? "Invalid input");
    }
    const track = parsed.data.track as WorkforceTrack;
    const windowStart = currentWindowStart();

    if (parsed.data.action === "auto") {
      const submissions = await prisma.availabilitySubmission.findMany({
        where: {
          track,
          windowStart,
          status: "SUBMITTED",
        },
        include: { slots: true },
      });
      const slots = submissions.flatMap((s) => s.slots);
      const optimized = optimizeScheduleFromAvailability(windowStart, slots);

      const schedule = await prisma.schedulePeriod.upsert({
        where: { track_windowStart: { track, windowStart } },
        create: {
          track,
          windowStart,
          status: PostedScheduleStatus.DRAFT,
          createdById: admin.id,
        },
        update: {
          status: PostedScheduleStatus.DRAFT,
          postedAt: null,
          createdById: admin.id,
        },
      });

      await prisma.scheduleEntry.deleteMany({ where: { scheduleId: schedule.id } });
      if (optimized.length) {
        await prisma.scheduleEntry.createMany({
          data: optimized.map((e) => ({
            scheduleId: schedule.id,
            userId: e.userId,
            day: e.day,
            hour: e.hour,
          })),
        });
      }

      const fresh = await prisma.schedulePeriod.findUnique({
        where: { id: schedule.id },
        include: {
          entries: {
            include: { user: { select: { id: true, name: true, email: true } } },
          },
        },
      });
      return Response.json({
        schedule: fresh,
        stats: {
          submissions: submissions.length,
          entries: optimized.length,
        },
      });
    }

    if (parsed.data.action === "clear") {
      const schedule = await prisma.schedulePeriod.findUnique({
        where: { track_windowStart: { track, windowStart } },
      });
      if (!schedule) throw new AppError("No schedule for this window", 404);
      if (schedule.status === PostedScheduleStatus.POSTED) {
        throw new AppError("Reopen the schedule before clearing", 400);
      }
      await prisma.scheduleEntry.deleteMany({ where: { scheduleId: schedule.id } });
      const fresh = await prisma.schedulePeriod.findUnique({
        where: { id: schedule.id },
        include: {
          entries: {
            include: { user: { select: { id: true, name: true, email: true } } },
          },
        },
      });
      return Response.json({ schedule: fresh });
    }

    if (parsed.data.action === "setEntry") {
      const schedule = await prisma.schedulePeriod.upsert({
        where: { track_windowStart: { track, windowStart } },
        create: {
          track,
          windowStart,
          status: PostedScheduleStatus.DRAFT,
          createdById: admin.id,
        },
        update: {},
      });
      if (schedule.status === PostedScheduleStatus.POSTED) {
        throw new AppError("Reopen the schedule before editing", 400);
      }
      await prisma.scheduleEntry.upsert({
        where: {
          scheduleId_userId_day_hour: {
            scheduleId: schedule.id,
            userId: parsed.data.userId,
            day: parseDayKey(parsed.data.day),
            hour: parsed.data.hour,
          },
        },
        create: {
          scheduleId: schedule.id,
          userId: parsed.data.userId,
          day: parseDayKey(parsed.data.day),
          hour: parsed.data.hour,
          note: parsed.data.note ?? null,
        },
        update: { note: parsed.data.note ?? null },
      });
      const fresh = await prisma.schedulePeriod.findUnique({
        where: { id: schedule.id },
        include: {
          entries: {
            include: { user: { select: { id: true, name: true, email: true } } },
          },
        },
      });
      return Response.json({ schedule: fresh });
    }

    if (parsed.data.action === "removeEntry") {
      const schedule = await prisma.schedulePeriod.findUnique({
        where: { track_windowStart: { track, windowStart } },
      });
      if (!schedule) throw new AppError("No schedule", 404);
      if (schedule.status === PostedScheduleStatus.POSTED) {
        throw new AppError("Reopen the schedule before editing", 400);
      }
      await prisma.scheduleEntry.deleteMany({
        where: {
          scheduleId: schedule.id,
          userId: parsed.data.userId,
          day: parseDayKey(parsed.data.day),
          hour: parsed.data.hour,
        },
      });
      const fresh = await prisma.schedulePeriod.findUnique({
        where: { id: schedule.id },
        include: {
          entries: {
            include: { user: { select: { id: true, name: true, email: true } } },
          },
        },
      });
      return Response.json({ schedule: fresh });
    }

    if (parsed.data.action === "post") {
      const schedule = await prisma.schedulePeriod.findUnique({
        where: { track_windowStart: { track, windowStart } },
      });
      if (!schedule) throw new AppError("Create a draft schedule first", 400);
      const updated = await prisma.schedulePeriod.update({
        where: { id: schedule.id },
        data: {
          status: PostedScheduleStatus.POSTED,
          postedAt: new Date(),
        },
        include: {
          entries: {
            include: { user: { select: { id: true, name: true, email: true } } },
          },
        },
      });
      return Response.json({ schedule: updated });
    }

    // reopen
    const schedule = await prisma.schedulePeriod.findUnique({
      where: { track_windowStart: { track, windowStart } },
    });
    if (!schedule) throw new AppError("No schedule", 404);
    const updated = await prisma.schedulePeriod.update({
      where: { id: schedule.id },
      data: {
        status: PostedScheduleStatus.DRAFT,
        postedAt: null,
      },
      include: {
        entries: {
          include: { user: { select: { id: true, name: true, email: true } } },
        },
      },
    });
    return Response.json({ schedule: updated });
  } catch (err) {
    return jsonError(err);
  }
}
