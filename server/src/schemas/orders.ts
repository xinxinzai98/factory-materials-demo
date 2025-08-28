import { z } from 'zod';

const itemDraft = z.object({
  materialCode: z.string().min(1),
  qty: z.union([z.string(), z.number()]).transform((v) => Number(v)).refine((n) => n > 0, 'qty must be > 0'),
  batchNo: z.string().optional(),
  expDate: z.string().optional(),
  uprice: z.union([z.string(), z.number()]).optional(),
});

export const inboundDraftSchema = z.object({
  code: z.string().min(1),
  sourceType: z.enum(['PURCHASE', 'RETURN', 'ADJUST_GAIN']),
  supplier: z.string().optional(),
  arriveDate: z.string().optional(),
  items: z.array(itemDraft).min(1),
});

export const outboundDraftSchema = z.object({
  code: z.string().min(1),
  purpose: z.enum(['MO_ISSUE', 'SALE', 'RETURN', 'ADJUST_LOSS']),
  items: z
    .array(
      z.object({
        materialCode: z.string().min(1),
        qty: z.union([z.string(), z.number()]).transform((v) => Number(v)).refine((n) => n > 0),
        // 兼容现有后端逻辑：SPECIFIED 表示指定批次，其它（SYSTEM/FEFO）走 FEFO
        batchPolicy: z.enum(['SPECIFIED', 'SYSTEM', 'FEFO']).default('FEFO'),
        batchNo: z.string().optional(),
      })
    )
    .min(1),
});

export const inboundImmediateSchema = inboundDraftSchema.extend({ warehouseCode: z.string().optional() });
export const outboundImmediateSchema = outboundDraftSchema;
