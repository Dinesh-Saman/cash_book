import { Request, Response, NextFunction } from 'express';

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  console.error(err);

  if (err.name === 'ValidationError') {
    const errors = err.errors || {};
    if (errors.voucherNo) {
      return res.status(400).json({
        success: false,
        message: 'Bitte geben Sie eine Belegnummer ein (z. B. BE-2026-001) / Please enter a voucher number (e.g. INV-2026-001).'
      });
    }
    if (errors.bookingRule) {
      return res.status(400).json({
        success: false,
        message: 'Bitte wählen Sie eine Buchungsregel aus / Please select a booking rule.'
      });
    }
    if (errors.amount) {
      return res.status(400).json({
        success: false,
        message: 'Bitte geben Sie einen gültigen Betrag ein / Please enter a valid amount.'
      });
    }
    if (errors.bookingText) {
      return res.status(400).json({
        success: false,
        message: 'Bitte geben Sie einen Buchungstext ein / Please enter a booking description.'
      });
    }
    const firstMsg = Object.values(errors).map((e: any) => e.message)[0];
    return res.status(400).json({
      success: false,
      message: firstMsg || 'Validierungsfehler / Validation error.'
    });
  }

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  res.status(statusCode).json({ success: false, message });
};
