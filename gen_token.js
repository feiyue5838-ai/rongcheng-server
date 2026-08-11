const jwt = require('jsonwebtoken');
const { readFileSync } = require('fs');
const dotenv = require('dotenv');
dotenv.config({ path: require('path').join(__dirname, '.env') });

const secret = process.env.JWT_SECRET || 'rongcheng-jwt-secret-2024';
const userId = '69efe4a1-e4b2-44cd-a7df-a31a3fa3a00f';
const token = jwt.sign({ sub: userId, openid: '', type: 'admin' }, secret, { expiresIn: '7d' });
console.log(token);
