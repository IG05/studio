# S3 Commander

S3 Commander is a secure, web-based portal for managing and auditing access to AWS S3 buckets.
It replaces the need for static, long-lived AWS credentials by implementing a robust request/approve workflow for temporary, time-bound access.

## Key Features

- **LDAP Integration**: Secure sign-on using existing corporate credentials.
- **Role-Based Access**: Granular permissions for Users, Admins, and a system Owner.
- **Temporary Access Workflow**: Users request access for a specific duration with justification.
- **Admin Dashboard**: Centralized management of requests, active permissions, and users.
- **Full Audit Trail**: Every significant action is logged for compliance and security.
- **S3 Object Browser**: View and download files from accessible buckets via a secure interface.

## Tech Stack

Built with Next.js, React, Tailwind CSS, ShadCN UI, NextAuth.js, MongoDB, and Genkit.
