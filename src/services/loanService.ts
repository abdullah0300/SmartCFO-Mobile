// src/services/loanService.ts
// Loan calculation functions - identical logic to web app

export interface AmortizationPayment {
  paymentNumber: number;
  paymentDate: Date;
  principalPayment: number;
  interestPayment: number;
  totalPayment: number;
  remainingBalance: number;
}

export interface LoanCalculation {
  monthlyPayment: number;
  totalPayments: number;
  totalInterest: number;
  totalAmount: number;
}

/**
 * Calculate monthly payment using loan formula
 * M = P [ i(1 + i)^n ] / [ (1 + i)^n - 1]
 */
export function calculateMonthlyPayment(
  principal: number,
  annualInterestRate: number,
  termInMonths: number
): number {
  if (principal <= 0 || termInMonths <= 0) return 0;

  // Handle 0% interest rate
  if (annualInterestRate === 0) {
    return principal / termInMonths;
  }

  const monthlyRate = annualInterestRate / 100 / 12;
  const numerator = principal * monthlyRate * Math.pow(1 + monthlyRate, termInMonths);
  const denominator = Math.pow(1 + monthlyRate, termInMonths) - 1;

  return numerator / denominator;
}

/**
 * Calculate full loan details
 */
export function calculateLoanDetails(
  principal: number,
  annualInterestRate: number,
  termInMonths: number
): LoanCalculation {
  const monthlyPayment = calculateMonthlyPayment(principal, annualInterestRate, termInMonths);
  const totalAmount = monthlyPayment * termInMonths;
  const totalInterest = totalAmount - principal;

  return {
    monthlyPayment,
    totalPayments: termInMonths,
    totalInterest,
    totalAmount,
  };
}

/**
 * Generate complete amortization schedule
 */
export function generateAmortizationSchedule(
  principal: number,
  annualInterestRate: number,
  termInMonths: number,
  startDate: Date,
  paymentFrequency: 'monthly' | 'biweekly' | 'weekly' = 'monthly'
): AmortizationPayment[] {
  const schedule: AmortizationPayment[] = [];

  if (principal <= 0 || termInMonths <= 0) return schedule;

  const monthlyPayment = calculateMonthlyPayment(principal, annualInterestRate, termInMonths);
  const monthlyRate = annualInterestRate / 100 / 12;

  let remainingBalance = principal;
  let currentDate = new Date(startDate);

  for (let i = 1; i <= termInMonths; i++) {
    const interestPayment = remainingBalance * monthlyRate;
    const principalPayment = monthlyPayment - interestPayment;
    remainingBalance = Math.max(0, remainingBalance - principalPayment);

    schedule.push({
      paymentNumber: i,
      paymentDate: new Date(currentDate),
      principalPayment,
      interestPayment,
      totalPayment: monthlyPayment,
      remainingBalance,
    });

    // Move to next payment date based on frequency
    switch (paymentFrequency) {
      case 'monthly':
        currentDate.setMonth(currentDate.getMonth() + 1);
        break;
      case 'biweekly':
        currentDate.setDate(currentDate.getDate() + 14);
        break;
      case 'weekly':
        currentDate.setDate(currentDate.getDate() + 7);
        break;
    }
  }

  return schedule;
}

/**
 * Calculate loan progress (percentage paid off)
 */
export function calculateLoanProgress(
  principal: number,
  currentBalance: number
): number {
  if (principal <= 0) return 0;
  const paidOff = principal - currentBalance;
  return (paidOff / principal) * 100;
}

/**
 * Find next payment due from schedule
 */
export function findNextPayment(
  schedule: AmortizationPayment[],
  paidPayments: number
): AmortizationPayment | null {
  if (paidPayments >= schedule.length) return null;
  return schedule[paidPayments] || null;
}

/**
 * Calculate remaining payments
 */
export function calculateRemainingPayments(
  schedule: AmortizationPayment[],
  currentPayment: number
): number {
  return Math.max(0, schedule.length - currentPayment);
}

/**
 * Calculate total interest paid so far
 */
export function calculateInterestPaid(
  schedule: AmortizationPayment[],
  paymentsMade: number
): number {
  return schedule
    .slice(0, paymentsMade)
    .reduce((sum, payment) => sum + payment.interestPayment, 0);
}

/**
 * Calculate total principal paid so far
 */
export function calculatePrincipalPaid(
  schedule: AmortizationPayment[],
  paymentsMade: number
): number {
  return schedule
    .slice(0, paymentsMade)
    .reduce((sum, payment) => sum + payment.principalPayment, 0);
}

/**
 * Calculate loan payoff date
 */
export function calculatePayoffDate(
  startDate: Date,
  termInMonths: number
): Date {
  const payoffDate = new Date(startDate);
  payoffDate.setMonth(payoffDate.getMonth() + termInMonths);
  return payoffDate;
}

/**
 * Calculate early payoff amount (remaining balance)
 */
export function calculateEarlyPayoff(
  principal: number,
  annualInterestRate: number,
  termInMonths: number,
  paymentsMade: number
): number {
  const schedule = generateAmortizationSchedule(
    principal,
    annualInterestRate,
    termInMonths,
    new Date()
  );

  if (paymentsMade >= schedule.length) return 0;
  return schedule[paymentsMade]?.remainingBalance || 0;
}

/**
 * Calculate interest saved by early payoff
 */
export function calculateInterestSaved(
  principal: number,
  annualInterestRate: number,
  termInMonths: number,
  paymentsMade: number
): number {
  const schedule = generateAmortizationSchedule(
    principal,
    annualInterestRate,
    termInMonths,
    new Date()
  );

  const totalInterest = schedule.reduce((sum, p) => sum + p.interestPayment, 0);
  const interestPaid = calculateInterestPaid(schedule, paymentsMade);
  const remainingInterest = totalInterest - interestPaid;

  return remainingInterest;
}
