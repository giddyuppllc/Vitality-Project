/**
 * One-off: ensure vital@vitalityproject.com is an ADMIN with a working
 * email+password login. Idempotent (upsert). Prints the generated password.
 *
 * Run:  node scripts/make-vital-admin.cjs
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const envPath = path.join(__dirname, '..', '.env.local');
const m = fs.readFileSync(envPath, 'utf8').match(/DATABASE_URL=["']?([^"'\n]+)["']?/);
if (!m) {
  console.error('DATABASE_URL not found in', envPath);
  process.exit(1);
}
process.env.DATABASE_URL = m[1];

const prisma = new PrismaClient();
const EMAIL = 'vital@vitalityproject.com';
const pw = 'Vital-' + crypto.randomBytes(6).toString('base64url') + '9';

(async () => {
  const hash = bcrypt.hashSync(pw, 10);
  await prisma.user.upsert({
    where: { email: EMAIL },
    update: { role: 'ADMIN', passwordHash: hash, emailVerified: new Date() },
    create: {
      email: EMAIL,
      name: 'Vitality Admin',
      role: 'ADMIN',
      passwordHash: hash,
      emailVerified: new Date(),
    },
  });

  // Verify the login path (NextAuth uses bcrypt.compare against passwordHash).
  const back = await prisma.user.findUnique({
    where: { email: EMAIL },
    select: { passwordHash: true, role: true },
  });
  const ok = bcrypt.compareSync(pw, back.passwordHash || '');

  console.log('');
  console.log('  ' + EMAIL + '  ->  role=' + back.role + '  login-check=' + ok);
  console.log('  ============================================');
  console.log('  PASSWORD: ' + pw);
  console.log('  ============================================');
  console.log('  (change it after first login)');

  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN' },
    select: { email: true },
  });
  console.log('  All admins now: ' + admins.map((a) => a.email).join(', '));

  await prisma.$disconnect();
})().catch((e) => {
  console.error('ERROR:', e.message);
  process.exit(1);
});
