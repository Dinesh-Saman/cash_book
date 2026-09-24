import mongoose from 'mongoose';
import { User } from './models/User';
import { BookingRule } from './models/BookingRule';
import { Settings } from './models/Settings';

import { DEFAULT_CONTRA_ACCOUNTS, STANDARD_DEFAULT_RULES } from './constants/defaultContraAccounts';

export { DEFAULT_CONTRA_ACCOUNTS };

export async function runSeeder() {
  const userCount = await User.countDocuments();
  let admin = await User.findOne({ role: 'admin' });

  if (userCount === 0 || !admin) {
    admin = await User.create({
      name: 'Admin',
      email: 'admin@cashbook.com',
      password: 'Admin@1234',
      role: 'admin'
    });
    console.log('Admin user created.');
  }

  const ruleCount = await BookingRule.countDocuments();
  if (ruleCount === 0) {
    let ruleNum = 1;
    for (const ruleName of STANDARD_DEFAULT_RULES) {
      const mapping = DEFAULT_CONTRA_ACCOUNTS[ruleName];
      await BookingRule.create({
        ruleNumber: ruleNum++,
        name: ruleName,
        isDefault: true,
        defaultVat: mapping?.defaultVat ?? 0,
        accountSKR03: mapping?.skr03 ?? '1360',
        accountSKR04: mapping?.skr04 ?? '1360',
        createdBy: admin._id
      });
    }
    console.log('Default booking rules seeded.');
  }

  const settingsCount = await Settings.countDocuments();
  if (settingsCount === 0) {
    await Settings.create({ openingBalance: 0 });
    console.log('Default settings created.');
  }
}

