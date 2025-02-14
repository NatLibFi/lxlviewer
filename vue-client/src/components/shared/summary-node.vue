<script>
/*

*/
import * as StringUtil from 'lxljs/string';
import LensMixin from '@/components/mixins/lens-mixin';
import ItemMixin from '@/components/mixins/item-mixin';
import OverflowMixin from '@/components/mixins/overflow-mixin';
import PreviewCard from '@/components/shared/preview-card';

export default {
  name: 'summary-node',
  mixins: [LensMixin, ItemMixin, OverflowMixin],
  props: {
    item: {
      type: [Object, String],
      default: null,
    },
    parentId: {
      type: String,
      default: '',
    },
    isLast: {
      type: Boolean,
      default: false,
    },
    isStatic: {
      type: Boolean,
      default: false,
    },
    handleOverflow: {
      type: Boolean,
      default: true,
    },
  },
  data() {
    return {
    };
  },
  computed: {
    isLinked() {
      if (this.focusData.hasOwnProperty('@id') && this.focusData['@id'].split('#')[0] !== this.parentId.split('#')[0]) {
        return true;
      }
      return false;
    },
    isLibrisResource() {
      return StringUtil.isLibrisResourceUri(this.recordId, this.settings);
    },
    routerPath() {
      const uriParts = this.recordId.split('/');
      const fnurgel = uriParts[uriParts.length - 1];
      return `/${fnurgel}`;
    },
  },
  components: {
    PreviewCard,
  },
  watch: {
  },
  mounted() {
    this.$nextTick(() => {});
  },
};
</script>

<template>
  <div class="SummaryNode">
    <span class="SummaryNode-label" v-if="!isLinked || isStatic" ref="ovf-label" @click.prevent.self="e => e.target.classList.toggle('expanded')">
      {{ typeof item === 'string' ? getStringLabel : getItemLabel }}{{ isLast ? '' : ';&nbsp;' }}
      <resize-observer v-if="handleOverflow" @notify="calculateOverflow" />
    </span>
    <v-popover v-if="isLinked && !isStatic" :disabled="!hoverLinks" @show="$refs.previewCard.populateData()" placement="bottom-start">
      <span class="SummaryNode-link tooltip-target">
        <router-link v-if="isLibrisResource" :to="routerPath">{{getItemLabel}}</router-link>
        <a v-if="!isLibrisResource" :href="focusData['@id'] | convertResourceLink">{{getItemLabel}}</a>
      </span>
      <template slot="popover" v-if="hoverLinks">
        <PreviewCard ref="previewCard" :focus-data="focusData" :record-id="recordId" />
      </template>
    </v-popover>
  </div>
</template>

<style lang="less">
.SummaryNode {
  display: inline-block;
  &-link {
    margin-right: 0.5em;
    > a {
      border-color: @brand-primary;
      color: darken(@brand-primary, 10%);
      text-decoration-line: underline;
      text-decoration-style: dotted;
      &:hover {
        color: darken(@brand-primary, 20%);
        border-color: darken(@brand-primary, 20%);
      }
    }
  }
  &-label {
    // max 3 lines before ellipsis
    // works in all major modern browsers
    // https://stackoverflow.com/a/13924997
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-inline-box;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    -webkit-box-orient: vertical;
    vertical-align: bottom;
    &.expanded {
      -webkit-line-clamp: unset;
      line-clamp: unset;
    }

    &.overflown {
      &::before {
        font-family: FontAwesome;
        content: "\F054";
        font-weight: normal;
        color: @brand-primary;
        display: inline-block;
        margin-right: 5px;
        transition: transform 0.1s ease;
      }

      &.expanded {
        &::before {
          transform: rotate(90deg);
        }
      }
    }
  }
}

</style>
