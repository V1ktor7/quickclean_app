import {
  AvailabilitySubmitStatus,
  Role,
  SlotAvailability,
  WorkforceTrack,
} from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { AppError, jsonError } from "@/lib/errors";
import { requireRole } from "@/lib/rbac";
import {
  WORK_HOURS,
  currentWindowStart,
  dayKey,
  parseDayKey,
  trackFromRole,
  windowDays,
} from "@/lib/schedule/window";

const slotSchema = z.object({
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  hour: z.number().int().min(8).max(17),
  status: z.enum(["AVAILABLE", "UNAVAILABLE", "UNKNOWN"]),
});

const putSchema = z.object({
  track: z.enum(["TECH", "SALES"]).optional(),
  slots: z.array(slotSchema).max(14 * 10),
});

function resolveTrack(userRole: Role, requested?: string): WorkforceTrack {
  if (userRole === Role.ADMIN) {
    if (requested === "TECH" || requested === "SALES") return requested;
    throw new AppError("Admin must pass track=TECH or track=SALES", 400);
  }
  const t = trackFromRole(userRole);
  if (!t) throw new AppError("Only tech/sales have availability", 403);
  return t;
}

async function ensureSubmission(userId: string, track: WorkforceTrack) {
  const windowStart = currentWindowStart();
  const existing = await prisma.availabilitySubmission.findUnique({
    where: {
      userId_track_windowStart: { userId, track, windowStart },
    },
    include: { slots: true },
  });
  if (existing) return existing;

  const days = windowDays(windowStart);
  const created = await prisma.availabilitySubmission.create({
    data: {
      userId,
      track,
      windowStart,
      status: AvailabilitySubmitStatus.DRAFT,
      slots: {
        create: days.flatMap((day) =>
          WORK_HOURS.map((hour) => ({
            userId,
            track,
            day,
            hour,
            status: SlotAvailability.UNKNOWN,
          })),
        ),
      },
    },
    include: { slots: true },
  });
  return created;
}

export async function GET(req: Request) {
  try {
    const user = await requireRole(Role.TECH, Role.SALES, Role.ADMIN);
    const url = new URL(req.url);
    const track = resolveTrack(user.role, url.searchParams.get("track") ?? undefined);
    const windowStart = currentWindowStart();

    if (user.role === Role.ADMIN) {
      const submissions = await prisma.availabilitySubmission.findMany({
        where: { track, windowStart },
        include: {
          user: { select: { id: true, name: true, email: true } },
          slots: true,
        },
        orderBy: { submittedAt: "desc" },
      });
      return Response.json({
        track,
        windowStart: windowStart.toISOString(),
        days: windowDays(windowStart).map(dayKey),
        hours: [...WORK_HOURS],
        submissions,
      });
    }

    const submission = await ensureSubmission(user.id, track);
    return Response.json({
      track,
      windowStart: windowStart.toISOString(),
      days: windowDays(windowStart).map(dayKey),
      hours: [...WORK_HOURS],
      submission,
    });
  } catch (err) {
    return jsonError(err);
  }
}

export async function PUT(req: Request) {
  try {
    const user = await requireRole(Role.TECH, Role.SALES, Role.ADMIN);
    const parsed = putSchema.safeParse(await req.json());
    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0]?.message ?? "Invalid input");
    }
    if (user.role === Role.ADMIN) {
      throw new AppError("Admins view availability; workers edit their own", 400);
    }
    const track = resolveTrack(user.role, parsed.data.track);
    const submission = await ensureSubmission(user.id, track);
    if (submission.status === AvailabilitySubmitStatus.SUBMITTED) {
      // Allow re-edit → back to draft until they confirm again
      await prisma.availabilitySubmission.update({
        where: { id: submission.id },
        data: { status: AvailabilitySubmitStatus.DRAFT, submittedAt: null },
      });
    }

    const windowStart = currentWindowStart();
    const allowedDays = new Set(windowDays(windowStart).map(dayKey));

    for (const s of parsed.data.slots) {
      if (!allowedDays.has(s.day)) continue;
      if (!WORK_HOURS.includes(s.hour as (typeof WORK_HOURS)[number])) continue;
      await prisma.availabilitySlot.updateMany({
        where: {
          submissionId: submission.id,
          day: parseDayKey(s.day),
          hour: s.hour,
        },
        data: { status: s.status as SlotAvailability },
      });
    }

    const fresh = await prisma.availabilitySubmission.findUnique({
      where: { id: submission.id },
      include: { slots: true },
    });
    return Response.json({ submission: fresh });
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireRole(Role.TECH, Role.SALES);
    const body = (await req.json().catch(() => ({}))) as { track?: string };
    const track = resolveTrack(user.role, body.track);
    const submission = await ensureSubmission(user.id, track);

    const updated = await prisma.availabilitySubmission.update({
      where: { id: submission.id },
      data: {
        status: AvailabilitySubmitStatus.SUBMITTED,
        submittedAt: new Date(),
      },
      include: {
        slots: true,
        user: { select: { id: true, name: true, email: true } },
      },
    });

    return Response.json({ submission: updated });
  } catch (err) {
    return jsonError(err);
  }
}
