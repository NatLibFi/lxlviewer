<script>
import { filter } from 'lodash-es';
import VueSimpleSpinner from 'vue-simple-spinner';
import { mapGetters } from 'vuex';
import * as VocabUtil from 'lxljs/vocab';
import * as DisplayUtil from 'lxljs/display';
import * as StringUtil from 'lxljs/string';
import * as HttpUtil from '@/utils/http';
import ItemVocab from '@/components/inspector/item-vocab';
import ModalComponent from '@/components/shared/modal-component';

export default {
  name: 'item-type',
  extends: ItemVocab,
  props: {
    containerAcceptedTypes: {
      type: Array,
      default: () => [],
    },
  },
  data() {
    return {
      numberOfRelations: null,
      checkingRelations: false,
      unlockedByUser: false,
      unlockModalOpen: false,
    };
  },
  computed: {
    ...mapGetters([
      'resources',
    ]),
    range() {
      const docType = VocabUtil.getRecordType(this.entityType, this.resources.vocab, this.resources.context);
      const combined = [docType].concat(VocabUtil.getAllSubClasses(docType, this.resources.vocabClasses, this.resources.context));
      const filtered = filter(combined, (o) => {
        const term = VocabUtil.getTermObject(o, this.resources.vocab, this.resources.context);
        return term.abstract !== true;
      });
      return filtered;
    },
    onMainEntity() {
      return this.path === 'mainEntity.@type';
    },
    unlockTooltip() {
      const activeLinks = StringUtil.getUiPhraseByLang('This entity has active links', this.user.settings.language, this.resources.i18n);
      const clickToUnlock = StringUtil.getUiPhraseByLang('Click to unlock editing', this.user.settings.language, this.resources.i18n);
      return `${activeLinks}. ${clickToUnlock}.`;
    },
    isDisabled() {
      return this.onMainEntity && this.numberOfRelations !== 0 && this.unlockedByUser === false;
    },
  },
  methods: {
    getLabelWithTreeDepth(term) {
      return DisplayUtil.getLabelWithTreeDepth(term, this.settings, this.resources);
    },
    unlockEdit() {
      this.unlockedByUser = true;
      this.closeUnlockModal();
    },
    openUnlockModal() {
      this.unlockModalOpen = true;
      setTimeout(() => {
        this.$refs.unlockButton.focus();
      }, 200);
    },
    closeUnlockModal() {
      this.unlockModalOpen = false;
    },
    getRelationsInfo() {
      this.checkingRelations = true;
      const query = {
        _limit: 0,
        o: this.inspector.data.mainEntity['@id'],
      };
      HttpUtil.getRelatedRecords(query, this.settings.apiPath)
        .then((response) => {
          this.numberOfRelations = response.totalItems;
          this.checkingRelations = false;
        }, (error) => {
          console.log('Error checking for relations', error);
        });
    },
  },
  watch: {
    isLocked(newVal, oldVal) {
      if (newVal === false && oldVal === true) {
        this.unlockedByUser = false;
      }
    },
  },
  mounted() {
    this.$nextTick(() => {
      if (this.numberOfRelations === null && this.onMainEntity) {
        this.getRelationsInfo();
      }
    });
  },
  components: {
    VueSimpleSpinner,
    ModalComponent,
  },
};

</script>

<template>
  <div class="ItemType" :id="`formPath-${path}`" v-bind:class="{'is-locked': isLocked, 'is-unlocked': !isLocked, 'distinguish-removal': removeHover, 'removed': removed}">
    <div v-if="!isLocked && checkingRelations">
      <vue-simple-spinner size="small"></vue-simple-spinner>
    </div>
    <div class="ItemType-selectContainer" v-if="!isLocked && !checkingRelations && containerAcceptedTypes.length > 0">
      <select 
        :disabled="isDisabled"
        v-model="selected" 
        class="ItemType-select customSelect" 
        :aria-label="fieldKey | labelByLang">
        <option 
          v-for="(term, index) in containerAcceptedTypes" 
          :value="term.id"
          :key="index"
          :disabled="term.abstract"
          v-html="getLabelWithTreeDepth(term, settings, resources)"
          ></option>
      </select>
      <div class="ItemType-actions">
        <div class="ItemType-action UnlockAction">
          <i role="button" class="fa fa-lock icon icon--sm" tabindex="0" aria-label="Unlock" v-tooltip.top="unlockTooltip" @keyup.enter="openUnlockModal()" @click="openUnlockModal()" v-if="isDisabled"></i>
        </div>
      </div>
    </div>
    <span class="ItemType-text" 
      v-if="isLocked">{{fieldValue | labelByLang}}
    </span>
    <modal-component 
      title="Byte av typ" 
      modal-type="warning" 
      class="ChangeTypeWarningModal" 
      :width="'570px'"
      @close="closeUnlockModal()"
      v-if="unlockModalOpen">
      <div slot="modal-body" class="ChangeTypeWarningModal-body">
        <p>
          <strong>{{ numberOfRelations }} {{ numberOfRelations === 1 ? 'annan entitet' : 'andra entiteter' }}</strong> länkar till denna entitet.
        </p>
        <p>
          Observera att byte av typ kan påverka de beskrivningar som länkar hit. Om du är osäker på konsekvenserna bör du ta del av hjälptexten innan du fortsätter.
        </p>
        <p><a href="https://libris.kb.se/katalogisering/help/use-the-editor" target="_blank">Läs mer om byte av typ</a></p>
        <div class="ChangeTypeWarningModal-buttonContainer">          
          <button class="btn btn-hollow btn--auto btn--md" @click="closeUnlockModal()">{{ 'Cancel' | translatePhrase }}</button>
          <!-- <button class="btn btn-grey btn--md" ref="cancelUnlockButton" @click="closeUnlockModal()">{{ 'Cancel' | translatePhrase }}</button> -->
          <button class="btn btn-warning btn--md" ref="unlockButton" @click="unlockEdit()">
            <i class="icon icon--white fa fa-unlock-alt"></i>
            {{ 'Unlock' | translatePhrase }}
          </button>
        </div>
      </div>
    </modal-component>
  </div>
</template>

<style lang="less">

.ItemType {
  flex-grow: 1;
  &.is-locked {
    line-height: 2;
    // padding-left: 5px;
  }

  &-text {
    word-break: break-word;
  }

  &-selectContainer {
    display: flex;
    align-items: center;
  }

  &-actions {
    flex-grow: 1;
    text-align: right;
  }
  &-action {
    display: inline-block;
    padding: 0 0.25em;
  }

  &-select {
    width: auto;
    margin-top: 0.2em;
    margin-right: 0.5em;
    display: inline-block;
    border: 1px solid @grey-light;
    background-color: @white;
    &:disabled {
      opacity: 0.7;
    }
  }
}

.ChangeTypeWarningModal {
  &-body {
    height: 80%;
    width: 100%;
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 24px 16px 15px 16px;
  }
  &-buttonContainer {
    text-align: right;
    margin: 20px 0 0 0;
    & > * {
      margin-left: 12px;
    }
  }
}

</style>
