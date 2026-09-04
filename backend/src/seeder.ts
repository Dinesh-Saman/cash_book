import mongoose from 'mongoose';
import { User } from './models/User';
import { BookingRule } from './models/BookingRule';
import { Settings } from './models/Settings';

export async function runSeeder() {
  const userCount = await User.countDocuments();
  if (userCount === 0) {
    const admin = await User.create({
      name: 'Admin',
      email: 'admin@cashbook.com',
      password: 'Admin@1234',
      role: 'admin'
    });

    const defaultRules = [
      'Cash from Bank (Deposit)',
      'Cash to Bank (Withdrawal)',
      'Cash Customer Invoice Receipt',
      'Supplier Invoice Payment',
      'Postage / Stamps',
      'Shipping / Freight 19%',
      'Office Materials 19%',
      'Office Materials 7%',
      'Other Costs 19%',
      'Other Costs 7%',
      'Hospitality 19%',
      'Vehicle (Fuel, Washing) 19%',
      'Travel Expenses 19%',
      'Lottery Cash Deposit'
    ];

    for (const ruleName of defaultRules) {
      await BookingRule.create({
        name: ruleName,
        isDefault: true,
        createdBy: admin._id
      });
    }

    await Settings.create({ openingBalance: 0 });
    console.log('Seeding completed.');
  }
}
