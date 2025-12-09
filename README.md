# MVP for Share

share is a platform for sharing! The apps purpose is to allow users to find everything that friends, family and strangers offer for borrowing in the area. The long-term goal is to integrate the platform with software like [leihbase](https://github.com/leihbase/leihbase), so that users can borrow both from private persons as well as from lending organisations like [Libraries of Things](https://en.wikipedia.org/wiki/Library_of_things) or for-profit lenders.

Here, we develop a first minimum viable product. Next milestones are roughly:

- 01/2026: Ready for user testing
- 03/2026: Most important feedback incorporated, remaining issues documented and planned for 
- 06/2026: Ready for integration with lending organisations
- 12/2026: Integration with lending organisations possible and demonstrated

For a more fine-grained timeline, see the attached [GitHub Project](https://github.com/orgs/share-open-sharing-infrastructure/projects/2).

# Documentation
The documentation for this project mainly lives in [docs](/docs/) and is statically rendered to our [GitHub Page](https://share-open-sharing-infrastructure.github.io/share-mvp/). Issues are managed in our [GitHub Project share-mvp](https://github.com/orgs/share-open-sharing-infrastructure/projects/2).

# Setup

share is based on Svelte and SvelteKit, and uses PocketBase (https://pocketbase.io/) for backend and storage. To setup your own instance, consider the steps below.

### Copy repository
Create a local copy of this repository.

### Setup local .env file and databse
In the root folder, create a `.env` file that stores your pocketbase URL e.g. `PB_URL=https://url...`. 

You also need to have a PocketBase instance running somewhere with a database scheme as documented in our [docs/data-model.md](/docs/data-model.md).

### Install dependencies

Once you've pulled the repository you can install dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```bash
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

### Building

To create a production version of your app:

```bash
npm run build
```

You can preview the production build with `npm run preview`.

