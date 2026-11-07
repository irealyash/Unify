import { clerkClient } from "@clerk/nextjs/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { ubcVerifications, users } from "@/lib/db/schema";

function allowedDomains() {
  const raw = process.env.UBC_VERIFIED_EMAIL_DOMAINS || "student.ubc.ca";
  return raw
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
}

export function getUbcAllowedDomains() {
  return allowedDomains();
}

export function isAllowedUbcDomain(email: string) {
  const domain = email.trim().toLowerCase().split("@")[1];
  if (!domain) return false;
  return allowedDomains().includes(domain);
}

/**
 * Start flow: validate domain server-side and persist a pending verification.
 * The client then uses Clerk's supported createEmailAddress + prepareVerification
 * + attemptVerification custom flow. Final trust comes from confirmUbcVerification.
 */
export async function startUbcVerification(params: {
  userId: string;
  educationEmail: string;
}) {
  const email = params.educationEmail.trim().toLowerCase();
  if (!email.includes("@")) {
    throw new Error("Enter a valid educational email");
  }
  if (!isAllowedUbcDomain(email)) {
    throw new Error(`Email domain must be one of: ${allowedDomains().join(", ")}`);
  }

  const [record] = await db
    .insert(ubcVerifications)
    .values({
      userId: params.userId,
      educationEmail: email,
      educationEmailNormalized: email,
      status: "pending",
    })
    .returning();

  await db
    .update(users)
    .set({ isUbcStudentClaim: true, updatedAt: new Date() })
    .where(eq(users.id, params.userId));

  return {
    verificationId: record.id,
    email,
    allowedDomains: allowedDomains(),
  };
}

/**
 * Confirm only after Clerk reports the secondary email as verified,
 * and the domain is on the allowlist. Never trust a client boolean.
 */
export async function confirmUbcVerification(params: {
  userId: string;
  clerkUserId: string;
  educationEmail: string;
  clerkEmailId?: string;
}) {
  const email = params.educationEmail.trim().toLowerCase();
  if (!isAllowedUbcDomain(email)) {
    throw new Error("Email domain is not on the UBC allowlist");
  }

  const client = await clerkClient();
  const clerkUser = await client.users.getUser(params.clerkUserId);

  const emailObj = clerkUser.emailAddresses.find((e) => {
    if (params.clerkEmailId) return e.id === params.clerkEmailId;
    return e.emailAddress.toLowerCase() === email;
  });

  if (!emailObj) {
    throw new Error("Educational email not found on your Clerk account");
  }

  if (emailObj.verification?.status !== "verified") {
    throw new Error("Educational email is not verified yet");
  }

  const verifiedEmail = emailObj.emailAddress.toLowerCase();
  if (!isAllowedUbcDomain(verifiedEmail)) {
    throw new Error("Verified email domain is not on the UBC allowlist");
  }

  const [latest] = await db
    .select()
    .from(ubcVerifications)
    .where(and(eq(ubcVerifications.userId, params.userId), eq(ubcVerifications.status, "pending")))
    .orderBy(desc(ubcVerifications.createdAt))
    .limit(1);

  if (latest) {
    await db
      .update(ubcVerifications)
      .set({
        status: "verified",
        verifiedAt: new Date(),
        educationEmail: verifiedEmail,
        educationEmailNormalized: verifiedEmail,
        clerkEmailId: emailObj.id,
      })
      .where(eq(ubcVerifications.id, latest.id));
  } else {
    await db.insert(ubcVerifications).values({
      userId: params.userId,
      educationEmail: verifiedEmail,
      educationEmailNormalized: verifiedEmail,
      clerkEmailId: emailObj.id,
      status: "verified",
      verifiedAt: new Date(),
    });
  }

  const [updatedUser] = await db
    .update(users)
    .set({
      isUbcStudentClaim: true,
      isUbcVerified: true,
      updatedAt: new Date(),
    })
    .where(eq(users.id, params.userId))
    .returning();

  return {
    isUbcVerified: updatedUser.isUbcVerified,
    isUbcStudentClaim: updatedUser.isUbcStudentClaim,
  };
}
