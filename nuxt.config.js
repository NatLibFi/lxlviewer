export default {
  // Global page headers: https://go.nuxtjs.dev/config-head
  head: {
    title: 'id.kb.se',
    htmlAttrs: {
      lang: 'sv'
    },
    meta: [
      { charset: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { hid: 'description', name: 'description', content: 'Building blocks for linked data at the National Library of Sweden' },
      { hid:'og:title', property:'og:title', content:'id.kb.se' },
      { hid:'og:site_name', property:'og:site_name', content:'id.kb.se' },
      { hid:'og:description', property:'og:description', content:'Building blocks for linked data at the National Library of Sweden' },
      { hid:'og:image', property:'og:image', content:`${process.env.API_PATH}/opengraph.png` },
      { hid:'og:image:width', property:'og:image:width', content:'1200' },
      { hid:'og:image:height', property:'og:image:height', content:'600' },
      { hid:'twitter:image', property:'twitter:image', content:`${process.env.API_PATH}/opengraph.png` },
      { hid:'twitter:card', name:'twitter:card', content:'summary_large_image' },
    ],
    link: [
      { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
      { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' }
    ]
  },

  // Global CSS: https://go.nuxtjs.dev/config-css
  css: [
    '~/assets/scss/main.scss',
  ],

  // Plugins to run before rendering page: https://go.nuxtjs.dev/config-plugins
  plugins: [
    '~plugins/filters.js',
    '~mixins/lxl.js',
  ],

  // Auto import components: https://go.nuxtjs.dev/config-components
  components: true,

  // Modules for dev and build (recommended): https://go.nuxtjs.dev/config-modules
  buildModules: [
    '@nuxtjs/dotenv'
  ],

  // Modules: https://go.nuxtjs.dev/config-modules
  modules: [
    '@nuxtjs/style-resources',
    '@nuxt/http',
  ],

  styleResources: {
    scss: ['~/assets/scss/*.scss']
  },

  publicRuntimeConfig: {
    apiPath: process.env.API_PATH || 'http://localhost:5000',
    siteName: 'id.kb.se',
    environment: process.env.ENV,
  },

  privateRuntimeConfig: {
  },

  // Build Configuration: https://go.nuxtjs.dev/config-build
  build: {
  }
}
