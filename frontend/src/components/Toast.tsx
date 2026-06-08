type Props = {
  message: string | null
  err?: boolean
}

export function Toast({ message, err }: Props) {
  if (!message) return null
  return <div className={err ? 'toast err' : 'toast ok'} role="status">{message}</div>
}
