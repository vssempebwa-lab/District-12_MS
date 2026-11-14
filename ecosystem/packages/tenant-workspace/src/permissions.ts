export function allowsAll(permissions: string[], required?: string[]): boolean {
  if (!required || required.length === 0) return true;
  if (permissions.includes("*")) return true;
  return required.every((permission) => permissions.includes(permission));
}
