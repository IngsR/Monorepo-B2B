# Angular

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 22.1.6.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.

```
angular
├─ .angular
├─ .editorconfig
├─ .prettierrc
├─ .turbo
│  └─ turbo-build.log
├─ angular.json
├─ package.json
├─ preview-err.log
├─ preview-out.log
├─ public
│  └─ favicon.ico
├─ README.md
├─ src
│  ├─ app
│  │  ├─ app.config.ts
│  │  ├─ app.routes.ts
│  │  ├─ app.ts
│  │  ├─ core
│  │  │  ├─ domain
│  │  │  │  ├─ api-failure.ts
│  │  │  │  ├─ auction-lifecycle.ts
│  │  │  │  ├─ enums.ts
│  │  │  │  ├─ format.ts
│  │  │  │  └─ models.ts
│  │  │  ├─ guards
│  │  │  │  └─ auth.guard.ts
│  │  │  ├─ interceptors
│  │  │  │  ├─ auth.interceptor.ts
│  │  │  │  └─ mock-api.interceptor.ts
│  │  │  ├─ mock
│  │  │  │  ├─ mock-api.ts
│  │  │  │  └─ mock-data.ts
│  │  │  ├─ services
│  │  │  │  ├─ api-client.ts
│  │  │  │  ├─ auction.service.ts
│  │  │  │  ├─ bid.service.ts
│  │  │  │  ├─ catalogue.service.ts
│  │  │  │  ├─ clock.service.ts
│  │  │  │  ├─ directory.service.ts
│  │  │  │  ├─ notification.service.ts
│  │  │  │  └─ session.service.ts
│  │  │  └─ state
│  │  │     └─ async-resource.ts
│  │  ├─ features
│  │  │  ├─ admin
│  │  │  │  ├─ bidders
│  │  │  │  │  └─ admin-bidders.component.ts
│  │  │  │  ├─ categories
│  │  │  │  │  └─ admin-categories.component.ts
│  │  │  │  ├─ users
│  │  │  │  │  └─ admin-users.component.ts
│  │  │  │  └─ vendors
│  │  │  │     └─ admin-vendors.component.ts
│  │  │  ├─ admin-dashboard.component.ts
│  │  │  ├─ auth
│  │  │  │  ├─ forgot-password
│  │  │  │  │  └─ forgot-password.component.ts
│  │  │  │  ├─ login.component.ts
│  │  │  │  └─ reset-password
│  │  │  │     └─ reset-password.component.ts
│  │  │  ├─ bidder
│  │  │  │  └─ my-bids.component.ts
│  │  │  ├─ landing
│  │  │  │  ├─ landing.component.ts
│  │  │  │  └─ not-found.component.ts
│  │  │  ├─ marketplace
│  │  │  │  ├─ auction-detail.component.ts
│  │  │  │  ├─ bid-panel.component.ts
│  │  │  │  └─ marketplace.component.ts
│  │  │  ├─ profile.component.ts
│  │  │  └─ vendor
│  │  │     ├─ auctions
│  │  │     │  ├─ auction-form.component.ts
│  │  │     │  ├─ auction-management.component.ts
│  │  │     │  └─ vendor-auction-list.component.ts
│  │  │     ├─ products
│  │  │     │  ├─ product-form.component.ts
│  │  │     │  └─ product-list.component.ts
│  │  │     └─ vendor-dashboard.component.ts
│  │  └─ shared
│  │     ├─ layout
│  │     │  ├─ navigation.ts
│  │     │  ├─ shell.component.ts
│  │     │  ├─ sidebar.component.ts
│  │     │  └─ topbar.component.ts
│  │     └─ ui
│  │        ├─ auction-card.component.ts
│  │        ├─ auction-lifecycle.component.ts
│  │        ├─ badge.component.ts
│  │        ├─ bid-history.component.ts
│  │        ├─ button.component.ts
│  │        ├─ countdown.component.ts
│  │        ├─ dialog.component.ts
│  │        ├─ form-field.component.ts
│  │        ├─ icon.component.ts
│  │        ├─ pagination.component.ts
│  │        ├─ price.component.ts
│  │        ├─ state-block.component.ts
│  │        └─ toast.component.ts
│  ├─ environments
│  │  └─ environment.ts
│  ├─ index.html
│  ├─ main.ts
│  └─ styles.scss
├─ tools
│  ├─ build.mjs
│  ├─ diag-detail.mjs
│  ├─ diag-panel.mjs
│  ├─ diag-session.mjs
│  ├─ preview.mjs
│  ├─ qa-flow-tmp.mjs
│  ├─ qa-flow.mjs
│  └─ serve.mjs
├─ tsconfig.app.json
├─ tsconfig.json
└─ tsconfig.spec.json

```