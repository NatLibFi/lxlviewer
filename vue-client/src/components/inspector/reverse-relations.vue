<script>
import VueSimpleSpinner from 'vue-simple-spinner';
import { mapGetters } from 'vuex';
import * as VocabUtil from 'lxljs/vocab';
import * as StringUtil from 'lxljs/string';
import * as MathUtil from '@/utils/math';
import * as HttpUtil from '@/utils/http';
import CreateItemButton from '@/components/inspector/create-item-button';
import RelationsList from '@/components/inspector/relations-list';
import RoundedButton from '@/components/shared/rounded-button.vue';

export default {
  name: 'reverse-relations',
  props: {
    mainEntity: null,
    compact: { type: Boolean, default: false },
    forceLoad: { type: Boolean, default: false }, // FIXME: on-record-loaded didn't work in item-entity
    mode: { type: String, default: 'default' }, // "default" or "items"
  },
  data() {
    return {
      checkingRelations: true,
      relationPath: '',
      myHolding: null,
      relationInfo: [],
      numberOfRelations: null,
      relationsListOpen: false,
      panelQuery: '',
    };
  },
  methods: {
    showPanel() {
      this.$store.dispatch('pushInspectorEvent', { 
        name: 'form-control', 
        value: 'close-modals',
      }).then(() => {
        this.$nextTick(() => {
          this.relationsListOpen = true;
          this.$parent.$el.classList.add('is-highlighted');
        });
      });
    },
    hidePanel() {
      this.relationsListOpen = false;
      this.$parent.$el.classList.remove('is-highlighted');
    },
    getRelationsInfo() {
      const query = {
        _limit: 0,
        _sort: `_sortKeyByLang.${this.user.settings.language || 'sv'}`,
      };
      
      if (this.mode !== 'items' && this.mainEntity.reverseLinks) {
        this.numberOfRelations = this.mainEntity.reverseLinks.totalItems;
        this.checkingRelations = false;
        query.o = this.mainEntity['@id'];
        this.panelQuery = Object.assign({}, query);
        this.$emit('numberOfRelations', this.numberOfRelations);
        return;
      }
      
      this.checkingRelations = true;
      const timeoutLength = 1100; // Needed so that the index has time to update 
      setTimeout(() => { //
        if (this.mode === 'items') {
          query['itemOf.@id'] = this.mainEntity['@id'];
          query['@type'] = 'Item';

          // Check if my sigel has holding
          const myHoldingQuery = Object.assign({}, query);
          myHoldingQuery._limit = 1;
          myHoldingQuery['heldBy.@id'] = this.user.getActiveLibraryUri();
          HttpUtil.getRelatedRecords(myHoldingQuery, this.settings.apiPath)
            .then((response) => {
              if (response.totalItems > 0) {
                this.myHolding = response.items[0]['@id'];
              } else this.myHolding = null;
            })
            .catch((error) => {
              console.log(error);
            });
        } else {
          query.o = this.mainEntity['@id'];
        }
        this.panelQuery = Object.assign({}, query);
        
        HttpUtil.getRelatedRecords(query, this.settings.apiPath)
          .then((response) => {
            this.relationInfo = response.items;
            this.numberOfRelations = response.totalItems;
            this.checkingRelations = false;
            this.$emit('numberOfRelations', this.numberOfRelations);
          }, (error) => {
            console.log('Error checking for relations', error);
          });
      }, timeoutLength);
    },
    gotoHolding() {
      const locationParts = this.myHolding.split('/');
      const fnurgel = locationParts[locationParts.length - 1];
      this.$router.push({ path: `/${fnurgel}` });
    },
  },
  computed: {
    ...mapGetters([
      'inspector',
      'resources',
      'user',
      'settings',
      'status',
    ]),
    numberOfRelationsCircle() {
      return MathUtil.getCompactNumber(this.numberOfRelations);
    },
    hasRelation() {
      return this.myHolding !== null;
    },
    recordType() {
      return VocabUtil.getRecordType(
        this.mainEntity['@type'], 
        this.resources.vocab, 
        this.resources.context,
      );
    },
    recordId() {
      return this.mainEntity['@id'];
    },
    translatedTooltip() {
      return StringUtil.getUiPhraseByLang(this.totalRelationTooltipText, this.user.settings.language, this.resources.i18n);
    },
    totalRelationTooltipText() {
      if (this.mode === 'items') {
        if (this.numberOfRelations === 0) {
          return 'No holdings';
        } if (Number.isNaN(this.numberOfRelations)) {
          return 'Holdings could not be loaded';
        } 
        return 'Show all holdings';
      } 
      if (this.numberOfRelations === 0) {
        return 'No uses';
      } if (Number.isNaN(this.numberOfRelations)) {
        return 'Uses could not be loaded';
      } 
      return 'Show all uses';
    },
  },
  events: {
  },
  components: {
    'create-item-button': CreateItemButton,
    'relations-list': RelationsList,
    'vue-simple-spinner': VueSimpleSpinner,
    'rounded-button': RoundedButton,
  },
  watch: {
    'inspector.event'(val) {
      if (val.name === 'form-control') {
        switch (val.value) { 
          case 'open-instances-window':
            this.showPanel();
            break;
          case 'close-modals':
            this.hidePanel();
            break;
          default:
        }
      } else if (val.name === 'record-events') {
        switch (val.value) {
          case 'on-record-loaded':
            this.getRelationsInfo();
            break;
          default:
        }
      }
    },
    relationsListOpen(val, oldVal) { 
      if (val !== oldVal) {
        this.$parent.$emit('relations-list-open', val);
      }
    },
    numberOfRelations(val) {
      this.numberOfRelations = val;
    },
    'user.settings.activeSigel'() {
      this.getRelationsInfo();
    },
  },
  mounted() {
    this.$nextTick(() => {
      if (this.$route.name === 'Search' || this.forceLoad) {
        this.getRelationsInfo();
      }
    });
  },
};
</script>

<template>
  <div class="ReverseRelations-container">
    <div class="ReverseRelations" v-if="recordType !== 'Item'">
      <div class="ReverseRelations-header uppercaseHeading--light">
        <span v-if="mode === 'items'">{{"Holding" | translatePhrase}}</span>
        <span v-else>{{"Used in" | translatePhrase}}</span>
      </div>
      <div class="ReverseRelations-btnContainer">
        <vue-simple-spinner class="ReverseRelations spinner compact"
          v-if="checkingRelations" 
          size="small">
        </vue-simple-spinner>
        <create-item-button class="ReverseRelations-button"
        v-if="!checkingRelations && mode === 'items' && user.isLoggedIn && user.getPermissions().registrant" 
        :compact="compact"
        :main-entity="mainEntity"
        :has-holding="hasRelation" 
        :checking-holding="checkingRelations" 
        :holding-id="myHolding"
        @done="checkingRelations=false"></create-item-button>
        <rounded-button
          v-if="!checkingRelations"
          :button-text="numberOfRelationsCircle"
          :disabled="!numberOfRelations || isNaN(numberOfRelations)"
          :indicator="numberOfRelations > 0"
          :icon="isNaN(numberOfRelations) ? 'exclamation' : false"
          :active="relationsListOpen"
          :label="totalRelationTooltipText"
          v-tooltip.top="translatedTooltip"
          @click="showPanel()">
        </rounded-button>
      </div>
    </div>
    <!-- end -->
    <portal to="sidebar">
      <relations-list 
        v-if="relationsListOpen"
        :query="panelQuery"
        :item-of="mainEntity"
        :list-context-type="recordType"
        :list-context-type-mode="mode === 'items' ? 'Instance' : ''"
        @close="hidePanel()"></relations-list>
    </portal>
  </div>
</template>

<style lang="less">
.ReverseRelations {
  display: flex;
  align-items: center;
  height: 40px;
  margin-left: 1em;
  
  &-number {
    float: left;
    margin: 0 0 10px;
  
    @media (min-width: @screen-sm) {
      float: right;
      text-align: right;
    }
  }

  &-label {
    margin-right: 5px;
  }

  &-header {
    margin-right: 5px;
  }

  &-btnContainer {
    display: flex;
    align-items: center;
  }

  &-spinner {
    margin-bottom: 10px;
  }
}
</style>
