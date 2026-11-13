## Installing on macOS

Download the `.dmg` for your Mac: `arm64` for Apple Silicon (M1 and later), `x64` for Intel. The app is not notarized, so macOS blocks the first launch ("damaged" or "cannot verify"). Allow it once:

- **System Settings → Privacy & Security** → scroll down → **Open Anyway** next to Redis Deck (the first dialog only offers Move to Bin; the app appears in Settings after that attempt), or
- run `xattr -cr "/Applications/Redis Deck.app"` in Terminal.
