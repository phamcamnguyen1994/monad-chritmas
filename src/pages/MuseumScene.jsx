import SailingScene from './SailingScene'

export default function MuseumScene(props) {
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.info('[MuseumScene] Legacy maze disabled — forwarding to SailingScene.')
  }
  return <SailingScene {...props} />
}


