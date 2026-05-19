<script setup>
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { useAlert } from 'dashboard/composables';
import axios from 'axios';

import PageHeader from '../../SettingsSubPageHeader.vue';
import Button from 'dashboard/components-next/button/Button.vue';

const { t } = useI18n();
const router = useRouter();

const inboxName = ref('');
const appKey = ref('');
const appSecret = ref('');
const sellerId = ref('');
const region = ref('th');
const isLoading = ref(false);
const webhookUrl = ref('');

const REGIONS = [
  { label: 'Thailand (TH)', value: 'th' },
  { label: 'Singapore (SG)', value: 'sg' },
  { label: 'Malaysia (MY)', value: 'my' },
  { label: 'Philippines (PH)', value: 'ph' },
  { label: 'Vietnam (VN)', value: 'vn' },
  { label: 'Indonesia (ID)', value: 'id' },
];

const adapterUrl = window.chatwootConfig?.adapterLazadaUrl || '';

const createChannel = async () => {
  if (
    !inboxName.value ||
    !appKey.value ||
    !appSecret.value ||
    !sellerId.value
  ) {
    useAlert(t('INBOX_MGMT.ADD.LAZADA.VALIDATION_ERROR'));
    return;
  }
  if (!adapterUrl) {
    useAlert(t('INBOX_MGMT.ADD.LAZADA.ADAPTER_NOT_CONFIGURED'));
    return;
  }

  isLoading.value = true;
  try {
    const res = await axios.post(`${adapterUrl}/internal/setup`, {
      inbox_name: inboxName.value.trim(),
      app_key: appKey.value.trim(),
      app_secret: appSecret.value.trim(),
      seller_id: sellerId.value.trim(),
      region: region.value,
    });

    webhookUrl.value = res.data.lazada_webhook_url;

    router.replace({
      name: 'settings_inboxes_add_agents',
      params: { page: 'new', inbox_id: res.data.inbox_id },
    });
  } catch {
    useAlert(t('INBOX_MGMT.ADD.LAZADA.API.ERROR_MESSAGE'));
  } finally {
    isLoading.value = false;
  }
};
</script>

<template>
  <div class="h-full w-full p-6 col-span-6">
    <PageHeader
      :header-title="$t('INBOX_MGMT.ADD.LAZADA.TITLE')"
      :header-content="$t('INBOX_MGMT.ADD.LAZADA.DESC')"
    />
    <form class="flex flex-wrap flex-col mx-0" @submit.prevent="createChannel">
      <div class="flex-shrink-0 flex-grow-0">
        <label>
          {{ $t('INBOX_MGMT.ADD.LAZADA.INBOX_NAME.LABEL') }}
          <input
            v-model="inboxName"
            type="text"
            :placeholder="$t('INBOX_MGMT.ADD.LAZADA.INBOX_NAME.PLACEHOLDER')"
          />
        </label>
      </div>

      <div class="flex-shrink-0 flex-grow-0">
        <label>
          {{ $t('INBOX_MGMT.ADD.LAZADA.APP_KEY.LABEL') }}
          <input
            v-model="appKey"
            type="text"
            :placeholder="$t('INBOX_MGMT.ADD.LAZADA.APP_KEY.PLACEHOLDER')"
          />
        </label>
      </div>

      <div class="flex-shrink-0 flex-grow-0">
        <label>
          {{ $t('INBOX_MGMT.ADD.LAZADA.APP_SECRET.LABEL') }}
          <input
            v-model="appSecret"
            type="password"
            :placeholder="$t('INBOX_MGMT.ADD.LAZADA.APP_SECRET.PLACEHOLDER')"
          />
        </label>
      </div>

      <div class="flex-shrink-0 flex-grow-0">
        <label>
          {{ $t('INBOX_MGMT.ADD.LAZADA.SELLER_ID.LABEL') }}
          <input
            v-model="sellerId"
            type="text"
            :placeholder="$t('INBOX_MGMT.ADD.LAZADA.SELLER_ID.PLACEHOLDER')"
          />
        </label>
      </div>

      <div class="flex-shrink-0 flex-grow-0">
        <label>
          {{ $t('INBOX_MGMT.ADD.LAZADA.REGION.LABEL') }}
          <select v-model="region">
            <option v-for="r in REGIONS" :key="r.value" :value="r.value">
              {{ r.label }}
            </option>
          </select>
        </label>
      </div>

      <div class="w-full mt-4">
        <Button
          :is-loading="isLoading"
          type="submit"
          solid
          blue
          :label="$t('INBOX_MGMT.ADD.LAZADA.SUBMIT_BUTTON')"
        />
      </div>
    </form>
  </div>
</template>
