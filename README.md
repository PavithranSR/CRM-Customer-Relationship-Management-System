<<<<<<< HEAD
This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

1. Create your environment file:

```bash
cp .env.example .env
# PowerShell
Copy-Item .env.example .env
```

2. Update `.env` with your PostgreSQL connection values.

3. Push Prisma schema and seed initial users:

```bash
npm run db:push
npm run db:seed
```

Default admin login after seeding:

```txt
Username: admin@mattengg.com
Password: Matt@321admin
```

4. Run the development server:

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

### Environment Variables for Vercel

Make sure to set these environment variables in your Vercel project settings:

- `AUTH_SECRET` or `NEXTAUTH_SECRET`: A secure random string for NextAuth encryption
- `DATABASE_URL`: Your PostgreSQL database connection string
- `DIRECT_URL`: Your direct PostgreSQL connection string for Prisma schema generation and migrations
- `NEXTAUTH_URL`: Optional if you deploy on Vercel. If you use a custom domain, set it to that exact live URL.

If your host provides alternate Postgres variable names such as `POSTGRES_URL`, `POSTGRES_PRISMA_URL`, `DATABASE_URL_UNPOOLED`, or `POSTGRES_URL_NON_POOLING`, the app will now accept those too.

You can generate a secure AUTH_SECRET using:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
=======
# CRM-Customer-Relationship-Management-System
Developed a CRM System using React.js, Node.js, Express.js, and REST APIs to manage customer data and sales leads. Implemented pipeline tracking, role-based access control (RBAC), and interactive dashboards with reporting and filtering features to improve workflow efficiency and customer relationship management.
>>>>>>> 854654ac2f5b48663848e82e722d0a001867f513
