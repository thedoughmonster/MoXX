export type Correction = Readonly<{
  code: string
  field: string
  message: string
  next_action: string
  announcement: string
  focus_target: string
}>

export function correction(
  code: string, field: string, message: string, nextAction: string,
): Correction {
  return { code, field, message, next_action: nextAction,
    announcement: message, focus_target: `preorder-${field}` }
}
