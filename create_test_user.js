const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
const jwt = require('jsonwebtoken');

async function main() {
  // Find existing user or create one
  let user = await p.user.findFirst({
    where: { nickname: { contains: '测试' } }
  });

  if (!user) {
    user = await p.user.create({
      data: {
        openid: 'test_openid_miniapp_dev',
        nickname: '测试用户-Dev',
        phone: '13800138888',
        status: 1,
      }
    });
    console.log('Created test user:', user.nickname, user.id);
  } else {
    console.log('Found test user:', user.nickname, user.id);
  }

  // Generate a test JWT for this user
  const token = jwt.sign(
    { sub: user.id, openid: user.openid, type: 'user' },
    'rongcheng-secret-key-2024',
    { expiresIn: '7d' }
  );
  console.log('\nTest user JWT:');
  console.log(token);
  p.$disconnect().then(() => process.exit(0));
}

main().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
