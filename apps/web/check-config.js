#!/usr/bin/env node

/**
 * Configuration checker for the web app
 * Run: node check-config.js
 */

console.log('🔍 Checking configuration...\n');

const requiredVars = [
  'NEXT_PUBLIC_API_URL',
  'NEXT_PUBLIC_WS_URL',
  'NEXT_PUBLIC_USE_REAL_API'
];

let allGood = true;

requiredVars.forEach(varName => {
  const value = process.env[varName];
  if (value) {
    console.log(`✅ ${varName} = ${value}`);
  } else {
    console.log(`❌ ${varName} is NOT set`);
    allGood = false;
  }
});

console.log('\n📋 Configuration Summary:');
console.log('─────────────────────────────────────');

if (allGood) {
  console.log('✅ All required environment variables are set!');
  
  // Validate URLs
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  const wsUrl = process.env.NEXT_PUBLIC_WS_URL;
  
  if (apiUrl?.startsWith('https://') && wsUrl?.startsWith('wss://')) {
    console.log('✅ Using production URLs (HTTPS/WSS)');
  } else if (apiUrl?.startsWith('http://localhost') && wsUrl?.startsWith('ws://localhost')) {
    console.log('⚠️  Using local development URLs');
  } else {
    console.log('⚠️  Mixed or unusual URL configuration detected');
    console.log('   API:', apiUrl);
    console.log('   WS:', wsUrl);
  }
} else {
  console.log('❌ Missing required environment variables');
  console.log('\n📝 Create a .env.local file with:');
  console.log('   NEXT_PUBLIC_API_URL=http://localhost:3000');
  console.log('   NEXT_PUBLIC_WS_URL=ws://localhost:3000/ws');
  console.log('   NEXT_PUBLIC_USE_REAL_API=true');
  process.exit(1);
}

console.log('─────────────────────────────────────\n');
