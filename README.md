# my-lol-tool

An Electron application with React and TypeScript

## Recommended IDE Setup

- [VSCode](https://code.visualstudio.com/) + [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) + [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)

## Project Setup

### Install

```bash
$ npm install
```

### Development

```bash
$ npm run dev
```

### Build

```bash
# For windows
$ npm run build:win

# For macOS
$ npm run build:mac

# For Linux
$ npm run build:linux
```

## License & Disclaimer

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

**Disclaimer:**
This software is provided "as is", without warranty of any kind. The authors are not responsible for any damage or data loss that may occur from using this application. Use at your own risk.

## Distribution & Costs

- **Costs**: This application uses free open-source libraries. Distributing via GitHub is generally free for public repositories. If you use a private repository, be aware of GitHub Actions minute limits. Use of the "winCodeSign" tool in the build pipeline is free but relies on external servers.
- **Code Signing**: The generated installer is **not signed** with a paid certificate. Therefore, when users try to install it, Windows SmartScreen will likely display a warning ("Windows protected your PC"). This is normal for unsigned software. To remove this warning, you would need to purchase a code signing certificate from a certificate authority.
