// A simple logger that only outputs messages in a development environment.

export function logDebug(message: string, ...optionalParams: any[]) {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[DEBUG] ${new Date().toISOString()}: ${message}`, ...optionalParams);
  }
}
