export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('.') && !/\.\w+$/.test(specifier)) {
    try {
      return await nextResolve(`${specifier}.ts`, context)
    } catch {
      // Fall through to Node's default resolver for directories and packages.
    }
  }
  return nextResolve(specifier, context)
}
