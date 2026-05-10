// Public payload accepted by POST /api/contact.
// Honeypot field `website` MUST be empty for a real human submission.
export interface ContactSubmission {
  name: string;
  email: string;
  sector?: string;
  message: string;
  source?: string;
  paquete?: string;
  website?: string;
}

export interface ContactRecord extends ContactSubmission {
  ip: string;
  createdAt: string;
}
