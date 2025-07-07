# **App Name**: S3 Commander

## Core Features:

- Cognito Authentication: Enable user authentication using AWS Cognito for secure access.
- Bucket Listing: List S3 buckets based on Cognito group access and temporary grants.
- S3 Object Browser: Allow users to navigate and view objects within accessible S3 buckets, and request access to inaccesible S3 buckets.
- Access Request Form: Implement temporary access requests through a user-friendly form.
- Admin Panel: Implement admin panel with temporary access request approvals.
- Auto-Expiry: Use Lambda or DynamoDB TTL to manage expiration of temporary access.

## Style Guidelines:

- Primary color: A cool, muted blue (#6699CC) evoking AWS's branding while maintaining a modern feel.
- Background color: Light gray (#F0F0F0) provides a neutral backdrop.
- Accent color: A vibrant teal (#008080) to highlight interactive elements.
- Body font: 'Inter' sans-serif, for its modern, neutral appearance, suits for the application's headings and body copy. 
- Utilize AWS-themed icons (e.g., S3 bucket, Cognito user) for intuitive navigation.
- Employ a clear, panel-based layout for buckets, objects, and admin controls.
- Provide subtle loading animations when fetching S3 data or assuming roles.