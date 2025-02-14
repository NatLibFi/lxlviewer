<script>
import { merge, cloneDeep } from 'lodash-es';
import { mixin as clickaway } from 'vue-clickaway';
import VueSimpleSpinner from 'vue-simple-spinner';
import * as DisplayUtil from 'lxljs/display';
import * as VocabUtil from 'lxljs/vocab';
import * as StringUtil from 'lxljs/string';
import PanelComponent from '@/components/shared/panel-component';
import PanelSearchList from '@/components/search/panel-search-list';
import Button from '@/components/shared/button';
import Sort from '@/components/search/sort';
import ModalPagination from '@/components/inspector/modal-pagination';
import FilterSelect from '@/components/shared/filter-select.vue';
import ParamSelect from '@/components/inspector/param-select.vue';
import SideSearchMixin from '@/components/mixins/sidesearch-mixin.vue';
import LensMixin from '../mixins/lens-mixin';

export default {
  name: 'search-window',
  mixins: [clickaway, LensMixin, SideSearchMixin],
  data() {
    return {
      extractDialogActive: false,
      showHelp: false,
      showExtractSummary: false,
      listItemSettings: {
        text: 'Replace local entity',
        styling: 'brand',
        show: true,
        inspectAction: true,
      },
      setSearchType: '',
    };
  },
  props: {
    extractable: {
      type: Boolean,
      default: false,
    },
    extracting: {
      type: Boolean,
      default: false,
    },
    itemInfo: {},
    index: {
      type: Number,
      default: 0,
    },
    copyTitle: {
      type: Boolean,
      default: false,
    },
    canCopyTitle: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: false,
    },
  },
  components: {
    'panel-search-list': PanelSearchList,
    'panel-component': PanelComponent,
    'modal-pagination': ModalPagination,
    'filter-select': FilterSelect,
    'param-select': ParamSelect,
    'vue-simple-spinner': VueSimpleSpinner,
    'button-component': Button,
    sort: Sort,
  },
  watch: {
    copyTitle(value) {
      this.$dispatch('set-copy-title', value);
    },
    isActive(value) {
      if (value) {
        this.show();
      } else {
        this.hide();
      }
    },
  },
  computed: {
    typeOfExtractingEntity() {
      return StringUtil.getLabelByLang(VocabUtil.getRecordType(this.itemInfo['@type'], this.resources.vocab, this.resources.context), this.user.settings.language, this.resources).toLowerCase();
    },
    displaySearchList() {
      return !this.searchInProgress && !this.extracting && this.keyword.length > 0 && this.searchResult.length > 0;
    },
    foundNoResult() {
      return !this.searchInProgress && this.searchResult.length === 0 && this.keyword.length > 0 && this.searchMade;
    },
  },
  methods: {
    getSearchParams(searchPhrase) {
      if (this.currentSearchParam == null) {
        return { q: searchPhrase };
      }

      const params = Object.assign({}, this.currentSearchParam.mappings || {});
      this.currentSearchParam.searchProps.forEach((param) => { params[param] = searchPhrase; });
      return params;
    },
    replaceWith(obj) {
      this.$emit('replace-with', obj);
    },
    extract() {
      this.$emit('extract');
    },
    addPayload(item) {
      const updatedListItemSettings = merge({ payload: item }, cloneDeep(this.listItemSettings));
      return updatedListItemSettings;
    },
    setSort($event) {
      this.sort = $event;

      if (this.keyword) {
        this.search();
      }
    },
    show() {
      this.$store.dispatch('pushInspectorEvent', {
        name: 'form-control',
        value: 'close-modals',
      })
        .then(() => {
          this.$nextTick(() => {
            this.active = true;
            this.setSearchType = '';
            this.$nextTick(() => {
              this.resetSearch();
              if (this.itemInfo !== null) {
                const cleanedChipString = DisplayUtil.getItemLabel(this.itemInfo, this.resources, this.inspector.data.quoted, this.settings).replace(/#|_|•|\[|\]/g, ' ').replace(/  +/g, ' ');
                this.keyword = cleanedChipString;
                this.search();
              }
              if (this.$refs.input) {
                this.$refs.input.focus();
              }
            });
          });
        });
    },
    hide() {
      if (!this.active) return;
      this.active = false;
      this.$parent.closeExtractDialog();
    },
    resetSearch() {
      this.keyword = '';
      this.searchMade = false;
      if (this.someValuesFrom.length > 0) {
        this.currentSearchTypes = this.someValuesFrom;
      } else {
        this.currentSearchTypes = this.allSearchTypes;
      }
      this.setSearchType = this.entityType;
      this.searchResult = [];
      this.resetParamSelect += 1;
    },
    search() {
      const self = this;
      this.typeArray = [].concat(this.currentSearchTypes);
      self.searchResult = [];
      self.searchMade = true;
      this.fetch(0);
    },
  },
};
</script>

<template>
  <div class="SearchWindow">
    <portal to="sidebar" v-if="active">
      <panel-component class="SearchWindow-panel SearchWindowPanel"
        v-if="active"
        :title="'Link entity' | translatePhrase"
        @close="hide()">
        <template slot="panel-header-info">
          <div class="PanelComponent-headerInfo help-tooltip-container"
            @mouseleave="showHelp = false">
            <i class="fa fa-question-circle icon icon--md"
              @mouseenter="showHelp = true">
            </i>
            <div class="PanelComponent-headerInfoBox help-tooltip" v-show="showHelp">
              <div>
                <p class="header">
                  {{"Step" | translatePhrase}} 1: {{"Search for existing linked entities" | translatePhrase}}
                </p>
              </div>
              <div>
                <p class="header">
                  {{"Step" | translatePhrase}} 2: {{"Identify and replace" | translatePhrase}}
                </p>
                <p>
                  {{"If you identify a matching linked entity, click it to replace the local entity with it" | translatePhrase}}.
                </p>
              </div>
              <div>
                <p class="header">
                  {{"Create and link entity" | translatePhrase}}
                </p>
                <p>
                  {{"If no matching linked entity is found you can create and link. This will create a linked entity containing the information in the entity chosen for linking" | translatePhrase}}.
                </p>
              </div>
            </div>
          </div>
        </template>
        <template slot="panel-header-extra">
          <div class="SearchWindow-header search-header">
            <div class="SearchWindow-extractControls">
              <div class="copy-title" v-if="canCopyTitle">
                <label>
                  <input type="checkbox" name="copyTitle" v-model="copyTitle" />
                  {{ "Copy title from" | translatePhrase }} {{this.editorData.mainEntity['@type'] | labelByLang}}
                </label>
              </div>
            </div>
            <div class="SearchWindow-search search">
              <div class="SearchWindow-filterSearchContainer">
                <div class="SearchWindow-filterSearchContainerItem">
                  <filter-select class="SearchWindow-filterSearchInput FilterSelect--openDown"
                    :class-name="'js-filterSelect'"
                    :label="'Show' | translatePhrase"
                    :custom-placeholder="filterPlaceHolder"
                    :options="{ tree: selectOptions, priority: priorityOptions }"
                    :options-all="allSearchTypes"
                    :options-all-suggested="someValuesFrom"
                    :is-filter="true"
                    :styleVariant="'material'"
                    :setValue="setSearchType"
                    v-on:filter-selected="setFilter($event)"></filter-select>
                </div>
                <div class="SearchWindow-filterSearchContainerItem">
                  <sort
                    :recordTypes="currentSearchTypes"
                    :currentSort="''"
                    :commonSortFallback="true"
                    :styleVariant="'material'"
                    @change="setSort($event)" />
                </div>
              </div>
              <div class="SearchWindow-inputContainer input-container form-group">
                <input
                  class="SearchWindow-input SearchWindow-entity-search-keyword-input customInput"
                  v-model="keyword"
                  ref="input"
                  autofocus
                  :placeholder="'Search' | translatePhrase"
                  :aria-label="'Search' | translatePhrase">
                <param-select class="SearchWindow-paramSelect"
                              :types="currentSearchTypes"
                              :reset="resetParamSelect"
                              v-on:param-selected="setParam($event)"></param-select>
              </div>
            </div>
          </div>
        </template>

        <template slot="panel-body">
          <panel-search-list
            v-if="!searchInProgress"
            class="SearchWindow-resultListContainer"
            :results="searchResult"
            :is-compact="isCompact"
            icon="chain"
            text="Replace local entity"
            :has-action="true"
            @use-item="replaceWith"
          />
          <div class="PanelComponent-searchStatus" v-show="keyword.length === 0 && !extracting && searchResult.length == 0">
            <p> {{ "Search for existing linked entities to replace your local entity" | translatePhrase }}.</p>
            <p v-if="itemInfo && extractable"> {{ "If you can't find an existing link, you can create one using your local entity below" | translatePhrase }}.</p>
          </div>
          <div class="PanelComponent-searchStatus" v-show="searchInProgress">
            <vue-simple-spinner size="large" :message="'Searching' | translatePhrase"></vue-simple-spinner>
          </div>
          <div class="PanelComponent-searchStatus" v-show="foundNoResult">
            <p>{{ "Your search gave no results" | translatePhrase }}.</p>
            <p v-if="itemInfo && extractable">{{ "Try again" | translatePhrase }} {{ "or create a link from your local data below" | translatePhrase }}.</p>
          </div>
          <div class="PanelComponent-searchStatus" v-show="extracting">
            <vue-simple-spinner size="large" :message="'Creating link' | translatePhrase"></vue-simple-spinner>
          </div>
        </template>
        <template slot="panel-footer">
          <div class="SearchWindow-resultControls" v-if="!searchInProgress && searchResult.length > 0" >
            <modal-pagination
              @go="go"
              :total-items="totalItems"
              :max-items="maxItems"
              :max-per-page="maxResults"
              :current-page="currentPage"
            >
            </modal-pagination>
            <div class="SearchWindow-listTypes">
              <i class="fa fa-th-list icon icon--md"
                role="button"
                @click="isCompact = false"
                @keyup.enter="isCompact = false"
                :class="{'icon--primary' : !isCompact}"
                :title="'Detailed view' | translatePhrase"
                tabindex="0"></i>
              <i class="fa fa-list icon icon--md"
                role="button"
                @click="isCompact = true"
                @keyup.enter="isCompact = true"
                :class="{'icon--primary' : isCompact}"
                :title="'Compact view' | translatePhrase"
                tabindex="0"></i>
            </div>
          </div>
          <div class="SearchWindow-footerContainer" v-if="itemInfo && extractable">
            <div class="SearchWindow-summaryContainer" v-show="showExtractSummary">
              <entity-summary
                :focus-data="itemInfo"
                :should-link="false"
                :valueDisplayLimit=1></entity-summary>
            </div>
            <div class="SearchWindow-dialogContainer">
              <p class="preview-entity-text uppercaseHeading">Vill du skapa {{ typeOfExtractingEntity }} av lokal entitet?</p>
              <p>
                Den lokala entiteten bryts ut och länkas. Förhandsgranska för att se hur den kommer att se ut.
              </p>
              <button-component
                :button-text="['Yes, create', typeOfExtractingEntity ]"
                icon="plus-circle"
                :variant="'primary'"
                :inverted="true"
                @click="extract()"
              />
              <button-component
                :button-text="showExtractSummary ? 'Hide' : 'Preview'"
                :transparent="true"
                :variant="'primary'"
                :inverted="true"
                :border="false"
                @click="showExtractSummary = !showExtractSummary"
              />
            </div>
          </div>
        </template>
      </panel-component>
    </portal>
  </div>
</template>

<style lang="less">

.SearchWindow {
  &-entitySummary {
    max-width: 100%;
    padding: 0;
    margin-bottom: 15px;

    .EntitySummary-title {
      font-size: 18px;
      font-size: 1.8rem;
    }

    .is-compact & {
      width: 60%;
      margin-bottom: 0;
    }
  }

  &-filterSearchContainer {
    width: 100%;
    display: flex;
    flex-direction: column;

    @media (min-width: @screen-xs) {
      flex-direction: row;
    }
  }

  &-filterSearchContainerItem {
    width: 100%;
    margin: 0.5em 1em 0 0;

    @media (min-width: @screen-xs) {
      width: 50%;
    }

    &:last-child {
      margin-right: 0;
    }
  }

  &-filterSearchInput {
    position: relative;
  }

  &-header {
    width: 100%;
    margin: 0 0 0.5em 0;
  }

  &-inputContainer {
    width: 100%;
    display: flex;
    position: relative;
    margin-bottom: 0;
    margin-top: 0.5em;
    background-color: @white;
    border: 1px solid @grey-lighter;
    border-radius: 0.2em;
  }

  &-inputContainer input {
    color: @black;
    background-color: @white;
    border: none;
    margin-right: 2px; // make tab-focus border look ok
    border-radius: 0;
  }

  &-inputContainer select {
    border-radius: 0;
  }

  &-paramSelect {
    border-left: 1px solid @grey-lighter;
    flex-basis: 33%;
  }

  &-extractControls {

    .copy-title {
      float: right;
      label {
        margin: 0;
        font-weight: normal;
      }
    }
  }

  &-resultControls {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin: 0 10px;
    border: solid @grey-lighter;
    border-width: 0 0 1px 0;
  }

  &-listTypes {
    display: flex;
    justify-content: space-between;
    align-items: center;
    height: 54px;
    width: 54px;
  }

  &-footerContainer {
    display: flex;
    flex-direction: column;

    .EntitySummary {
      max-height: inherit;
      max-height: fit-content;
      overflow: auto;
      padding: 0;
    }
  }

  &-summaryContainer {
    display: flex;
    flex-direction: row;
    border: solid @grey-lighter;
    border-width: 0 0 1px 0;
    background: @white;
    padding: 1rem 2rem;
  }

  &-dialogContainer {
    padding: 1rem 2rem;
    .preview-entity-text {
      margin: 0;
    }
    .Button:not(:first-of-type) {
      margin-left: 1em;
    }
  }

  &-panel {
  }

  &-resultListContainer {
    flex: 1 1 auto;
  }

  &-resultList {
    padding: 0; // Make sure last item is fully visible
  }

  &-resultItem {
    flex-direction: column;
    align-items: flex-start;

    &.is-compact {
      flex-direction: row;
      align-items: center;
      justify-content: space-between;
      padding: 10px 15px;
    }
  }

  &-listItemControls {
    display: flex;
    justify-content: flex-start;
    width: 100%;

    .is-compact & {
      width: 150px;
    }
  }

  &-searchStatusContainer {
  }

  &-searchStatus {
  }
}

</style>
