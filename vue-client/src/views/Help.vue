<script>
import { orderBy } from 'lodash-es';
import marked from 'marked';
import moment from 'moment';
import { mapGetters } from 'vuex';
import * as StringUtil from 'lxljs/string';

export default {
  name: 'help-component',
  data() {
    return {
      openAll: 'open-all',
      activeCategory: '',
      loading: true,
    };
  },
  methods: {
    setSectionTitle() {
      const value = this.activeSectionTitle;
      let titleStr = '';
      if (value === 'Start') {
        titleStr = StringUtil.getUiPhraseByLang('Help', this.user.settings.language, this.resources.i18n);
      } else {
        titleStr = `${value} - ${StringUtil.getUiPhraseByLang('Help', this.user.settings.language, this.resources.i18n)}`;
      }
      this.$store.dispatch('setStatusValue', { 
        property: 'helpSectionTitle',
        value: titleStr,
      });
    },
    getImagePath(imgName) {
      const pathParts = imgName.split('/');
      const fileName = pathParts[pathParts.length - 1];
      const fetchedFileName = `${this.settings.apiPath}/helpdocs/${fileName}`;
      return fetchedFileName;
    },
    resolveImages(html) {
      const parser = new DOMParser();
      const htmldoc = parser.parseFromString(html, 'text/html');
      const images = htmldoc.getElementsByTagName('img');
      for (const img of images) {
        img.src = this.getImagePath(img.src);
      }
      return htmldoc.body.innerHTML;
    },
    getHTML(markdown) {
      const html = this.transformMarkdownToHTML(markdown);
      const htmlFixedImages = this.resolveImages(html);
      return htmlFixedImages;
    },
    transformMarkdownToHTML(markdown) {
      const html = marked(markdown);
      return html;
    },
    getTimeAgoString(date) {
      const today = moment().startOf('day');
      if (today.isSame(date, 'day')) {
        return StringUtil.getUiPhraseByLang('Today', this.user.settings.language, this.resources.i18n).toLowerCase();
      }
      return moment(date, 'YYYY-MM-DD').from(moment().startOf('day'));
    },
    getDateString(date) {
      return moment(date).format('YYYY-MM-DD');
    },
    getSectionUri(value) {
      return `/help/${value}`;
    },
  },
  updated() {
    this.$nextTick(() => {
      this.setSectionTitle();
    });
  },
  mounted() {
    this.$nextTick(() => {
      this.setSectionTitle();
    });
  },
  components: {
  },
  watch: {
  },
  events: {
  },
  computed: {
    ...mapGetters([
      'user',
      'settings',
      'status',
      'resources',
    ]),
    activeSection() {
      return this.$route.params.section || 'index';
    },
    sectionIsUpdating() {
      if (this.activeSectionData.tags !== null && this.activeSectionData.tags.indexOf('under arbete') > -1) {
        return true;
      }
      return false;
    },
    activeSectionTitle() {
      if (this.activeSectionData === null) {
        return '';
      }
      return this.activeSectionData.title;
    },
    activeSectionData() {
      for (const section in this.docs) {
        if (this.docs[section].basename === this.activeSection) {
          return this.docs[section];
        }
      }
      return null;
    },
    status() {
      return this.$store.getters.status;
    },
    helpCategories() {
      const json = this.docs;
      const sortedJson = orderBy(json, ['order'], ['asc']);
      const categories = {};
      for (const section in sortedJson) {
        if (Object.prototype.hasOwnProperty.call(sortedJson, section)) {
          const cat = sortedJson[section].section;
          if (categories.hasOwnProperty(cat) === false) {
            categories[cat] = [];
          }
          categories[cat].push(sortedJson[section]);
        }
      }
      return categories;
    },
    docs() {
      const json = this.resources.helpDocs;
      if (json === null) {
        return {};
      }
      delete json.default;
      delete json.readme;
      return json;
    },
  },
};
</script>

<template>

  <div class="HelpSection">
    <div v-if="resources.helpDocs == null" class="text-center MainContent-spinner">
      {{ 'Couldn\t load help documentation' | translatePhrase }}. {{ 'Try reloading the page' | translatePhrase }}.
    </div>
    <div class="row" v-if="resources.helpDocs != null">
      <div class="col-md-3">
        <div class="HelpSection-menu">
          <ul class="HelpSection-categories">
            <li class="HelpSection-categoryItem"
              v-for="(value, key) in helpCategories" 
              :key="key" 
              v-bind:class="{'is-active': key == activeCategory }" 
              v-on:click="activeCategory = key">
              <span class="HelpSection-categoryItemLabel" v-if="key !== 'Main'">{{key}}</span>
              <ul class="HelpSection-categoryList">
                <li class="HelpSection-categoryListItem" v-for="(section, index) in value" 
                  :key="index" 
                  v-bind:class="{'active': section.basename == activeSection }">
                  <router-link :to="getSectionUri(section.basename)">{{section.title}}</router-link>
                </li>
              </ul>
            </li>
          </ul>
        </div>
      </div>
      <div class="col-md-9">
        <article class="HelpSection-article is-fromMarkdown panel panel-default">
          <div>
            <div class="pull-right text-right" v-show="activeSectionData.date">
              <span class="label label-primary" v-if="sectionIsUpdating">UNDER ARBETE</span> <span :title="getDateString(activeSectionData.date)">Uppdaterad {{ getTimeAgoString(activeSectionData.date) }}</span>
            </div>
            <br v-show="activeSectionData.date">
            <div v-html="getHTML(activeSectionData.content)"></div>
          </div>
        </article>
      </div>
    </div>
  </div>
</template>

<style lang="less">

.HelpSection {
  padding-bottom: 2rem;
  
  &-article {
    padding: 30px;
    height: 100%;

    &.is-fromMarkdown {
      h2, h3, h4 {
        font-weight: normal;
        margin: 20px 0 15px;
      }

      p {
        margin: 0.5em 0px 1em;
      }

      code {
        padding: 4px;
        font-size: 90%;
        color: @black;
        background-color: #fbebef;
      }

      img {
        max-width: 100%;
      }

      table {
        font-size: 12px;
        font-size: 1.2rem;
        border: 1px solid @grey-lighter;
        width: 100%;
      }

      tr {
        width: 100%;
      }

      td {
        padding: 5px;
      }

      tr:nth-child(even) {
        background: @list-item-bg-even;
      }

      th {
        background: @grey-lighter;
        padding: 5px;
        text-transform: uppercase;
        line-height: 1.2;
      }
    }
  }

  &-categories {
    list-style: none;
    padding: 0;
  }

  &-categoryItem {
    display: block;
    margin: 10px 0;
    overflow: hidden;
  }

  &-categoryItemLabel {
    color: @black;
    font-size: 14px;
    font-size: 1.4rem;
    text-transform: uppercase;
    padding: 0;
    font-weight: 600;
  }

  &-categoryList {
    list-style: none;
    padding: 0;
  }

  &-categoryListItem {
    margin: 3px 0px;
    cursor: pointer;

    &:hover:not(.active) {
      text-decoration: underline;
    }

    &.active {
      font-weight: 700;
      cursor: initial;
    }
  }
}

</style>
