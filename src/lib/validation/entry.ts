import { z } from 'zod';

export const entrySchema = z
  .object({
    type: z.enum(['expense', 'income', 'transfer']),
    amount: z.number().positive('Amount must be greater than 0').max(9999999.99, 'Amount exceeds maximum limit'),
    occurredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
    accountId: z.string().min(1, 'Wallet is required'),
    toAccountId: z.string().nullish(),
    itemId: z.string().nullish(),
    note: z.string().max(500, 'Note cannot exceed 500 characters').nullish(),
  })
  .superRefine((data, ctx) => {
    if (data.type === 'transfer') {
      if (!data.toAccountId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Destination wallet is required for transfers',
          path: ['toAccountId'],
        });
      } else if (data.toAccountId === data.accountId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Source and destination wallets must be different',
          path: ['toAccountId'],
        });
      }
    } else {
      if (!data.itemId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Item is required for expenses and income',
          path: ['itemId'],
        });
      }
    }
  });

export type ValidatedEntryInput = z.infer<typeof entrySchema>;

export function validateEntry(input: unknown) {
  return entrySchema.safeParse(input);
}
