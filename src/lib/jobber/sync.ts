import { prisma } from "@/lib/db";
import { jobberGraphQL } from "@/lib/jobber/client";

type ClientsPage = {
  clients: {
    nodes: Array<{
      id: string;
      name: string;
      firstName?: string | null;
      lastName?: string | null;
      isCompany?: boolean | null;
      isArchived?: boolean | null;
      jobberWebUri?: string | null;
      emails?: Array<{ address?: string | null }> | null;
      phones?: Array<{ number?: string | null }> | null;
      tags?: { nodes: Array<{ label?: string | null }> } | null;
      updatedAt?: string | null;
    }>;
    pageInfo: { hasNextPage: boolean; endCursor?: string | null };
  };
};

type JobsPage = {
  jobs: {
    nodes: Array<{
      id: string;
      title?: string | null;
      jobStatus?: string | null;
      jobberWebUri?: string | null;
      completedAt?: string | null;
      startAt?: string | null;
      client?: { id: string } | null;
    }>;
    pageInfo: { hasNextPage: boolean; endCursor?: string | null };
  };
};

const CLIENTS_QUERY = `
  query GetClients($cursor: String) {
    clients(first: 50, after: $cursor, filter: { isArchived: false }) {
      nodes {
        id
        name
        firstName
        lastName
        isCompany
        isArchived
        jobberWebUri
        emails { address }
        phones { number }
        tags { nodes { label } }
        updatedAt
      }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

const JOBS_QUERY = `
  query GetJobs($cursor: String) {
    jobs(first: 50, after: $cursor) {
      nodes {
        id
        title
        jobStatus
        jobberWebUri
        completedAt
        startAt
        client { id }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

function isCommercial(tags: string[], isCompany?: boolean | null) {
  if (isCompany) return true;
  return tags.some((t) => /commercial|biz|business/i.test(t));
}

export async function syncJobberClients(): Promise<{ upserted: number }> {
  let cursor: string | null = null;
  let hasNext = true;
  let upserted = 0;

  while (hasNext) {
    const data: ClientsPage = await jobberGraphQL<ClientsPage>(CLIENTS_QUERY, {
      cursor,
    });
    for (const c of data.clients.nodes) {
      const tags = (c.tags?.nodes ?? [])
        .map((t) => t.label)
        .filter((x): x is string => Boolean(x));
      const email = c.emails?.[0]?.address ?? null;
      const phone = c.phones?.[0]?.number ?? null;

      await prisma.jobberClient.upsert({
        where: { jobberId: c.id },
        create: {
          jobberId: c.id,
          name: c.name,
          firstName: c.firstName ?? null,
          lastName: c.lastName ?? null,
          email,
          phone,
          tags: JSON.stringify(tags),
          isCommercial: isCommercial(tags, c.isCompany),
          isArchived: Boolean(c.isArchived),
          jobberWebUri: c.jobberWebUri ?? null,
          rawJson: JSON.stringify(c),
          syncedAt: new Date(),
        },
        update: {
          name: c.name,
          firstName: c.firstName ?? null,
          lastName: c.lastName ?? null,
          email,
          phone,
          tags: JSON.stringify(tags),
          isCommercial: isCommercial(tags, c.isCompany),
          isArchived: Boolean(c.isArchived),
          jobberWebUri: c.jobberWebUri ?? null,
          rawJson: JSON.stringify(c),
          syncedAt: new Date(),
        },
      });
      upserted += 1;
    }

    hasNext = data.clients.pageInfo.hasNextPage;
    cursor = data.clients.pageInfo.endCursor ?? null;
  }

  return { upserted };
}

export async function syncJobberJobs(): Promise<{ upserted: number }> {
  let cursor: string | null = null;
  let hasNext = true;
  let upserted = 0;

  while (hasNext) {
    const data: JobsPage = await jobberGraphQL<JobsPage>(JOBS_QUERY, { cursor });
    for (const j of data.jobs.nodes) {
      let clientId: string | null = null;
      if (j.client?.id) {
        const local = await prisma.jobberClient.findUnique({
          where: { jobberId: j.client.id },
          select: { id: true },
        });
        clientId = local?.id ?? null;

        if (j.completedAt && local) {
          await prisma.jobberClient.update({
            where: { id: local.id },
            data: { lastServiceAt: new Date(j.completedAt) },
          });
        }
      }

      await prisma.jobberJob.upsert({
        where: { jobberId: j.id },
        create: {
          jobberId: j.id,
          clientId,
          title: j.title ?? null,
          status: j.jobStatus ?? null,
          completedAt: j.completedAt ? new Date(j.completedAt) : null,
          scheduledAt: j.startAt ? new Date(j.startAt) : null,
          jobberWebUri: j.jobberWebUri ?? null,
          rawJson: JSON.stringify(j),
          syncedAt: new Date(),
        },
        update: {
          clientId,
          title: j.title ?? null,
          status: j.jobStatus ?? null,
          completedAt: j.completedAt ? new Date(j.completedAt) : null,
          scheduledAt: j.startAt ? new Date(j.startAt) : null,
          jobberWebUri: j.jobberWebUri ?? null,
          rawJson: JSON.stringify(j),
          syncedAt: new Date(),
        },
      });
      upserted += 1;
    }

    hasNext = data.jobs.pageInfo.hasNextPage;
    cursor = data.jobs.pageInfo.endCursor ?? null;
  }

  return { upserted };
}

export async function syncAllJobber() {
  const clients = await syncJobberClients();
  const jobs = await syncJobberJobs();
  return { clients: clients.upserted, jobs: jobs.upserted };
}
