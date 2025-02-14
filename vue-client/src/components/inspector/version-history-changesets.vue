<script>
/*
  Changeset list
*/
import { mapGetters } from 'vuex';
import LensMixin from '@/components/mixins/lens-mixin';
import SummaryNode from '@/components/shared/summary-node.vue';

export default {
  mixins: [LensMixin],
  props: {
    changeSets: {
      type: Array,
      default: () => [],
    },
    selectedVersion: {
      type: Number,
      default: 0,
    },
  },
  data() {
    return {
      fetchedVersionData: null,
      focusedTab: 'mainEntity',
      inspectingPath: '',
    };
  },
  computed: {
    ...mapGetters([
      'inspector',
      'resources',
      'user',
      'settings',
      'status',
    ]),
    changeSetsReversed() {
      if (this.changeSets != null) {
        return [...this.changeSets].reverse();
      }
      return null;
    },
    selectedChangeSet() {
      return this.changeSetsReversed[this.selectedVersion];
    },
  },
  watch: {
    'inspector.event'(val) {
      if (val.name === 'field-label-clicked') {
        this.inspectingPath = val.value;
        this.$refs.changeSet[this.selectedVersion].scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'start' });
      }
    },
  },
  methods: {
    isGlobalChanges(changeSet) {
      return changeSet.agent['@id'].includes('sys/globalchanges');
    },
    selectVersion(val) {
      this.$emit('version-selected', val);
    },
  },
  components: {
    SummaryNode,
  },
  mounted() {
  },
};
</script>

<template>
  <div class="VersionHistory-changeSets" v-if="changeSetsReversed">
    <div class="ChangeSet" v-for="(changeSet, index) in changeSetsReversed" ref="changeSet" :key="changeSet.date" @click="selectVersion(index)" @keyup.enter="selectVersion(index)" :class="{ 'selected': selectedVersion == index }" tabindex=0>
      <div class="ChangeSet-changeSetContainer" :class="{ 'selected': selectedVersion == index }">
        <span class="ChangeSet-currentVersion" :class="{ 'selected': selectedVersion == index }" v-if="index == 0">{{"Current version" | translatePhrase}}</span>
        <div class="ChangeSet-dateContainer">
        <span class="ChangeSet-date" :class="{ 'selected': selectedVersion == index }">{{ $moment(changeSet.date).format('lll') }}</span>
        <span class="ChangeSet-tool" v-if="changeSet.tool['@id'] !== 'https://id.kb.se/generator/crud'">{{"by machine" | translatePhrase}}</span>
        </div>
        <span class="ChangeSet-author" :class="{ 'selected': selectedVersion == index }">
          <SummaryNode :is-static="true" :hover-links="false" :handle-overflow="false" v-if="changeSet.agent && !isGlobalChanges(changeSet)" :item="changeSet.agent" :is-last="true" :field-key="'agent'"/>
          <span v-if="isGlobalChanges(changeSet)">
                <v-popover placement="bottom-start">
                  {{ 'Libris global changes' | translatePhrase }}
                  <template slot="popover">
                    <span>{{changeSet.agent['@id']}}</span>
                  </template>
                </v-popover>
          </span>
        </span>
      </div>
    </div>
  </div>
</template>

<style lang="less">

.VersionHistory-changeSets {
  overflow-y: scroll;
  flex-grow: 1;
  height: 100%;
}

</style>
