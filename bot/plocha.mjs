// Cloud version of the Mac's plocha.mjs: where the generators put their work.
import { tmpdir } from 'node:os'
import { join } from 'node:path'
export const FM_INSTAGRAM = process.env.FM_OUT || join(tmpdir(), 'fm-instagram')
export const today = (d = new Date()) => d.toISOString().slice(0, 10)
