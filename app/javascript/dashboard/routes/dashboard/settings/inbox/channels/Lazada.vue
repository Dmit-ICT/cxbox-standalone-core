<script setup>
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useVuelidate } from '@vuelidate/core';
import { required } from '@vuelidate/validators';
import { useAlert } from 'dashboard/composables';
import axios from 'axios';

import PageHeader from '../../SettingsSubPageHeader.vue';
import Button from 'dashboard/components-next/button/Button.vue';

const { t } = useI18n();

const inboxName = ref('');
const appKey = ref('');
const appSecret = ref('');
const region = ref('th');
const isLoading = ref(false);

const rules = {
  inboxName: { required },
  appKey: { required },
  appSecret: { required },
};

const v$ = useVuelidate(rules, { inboxName, appKey, appSecret });

const REGIONS = [
  { label: 'Thailand (TH)', value: 'th' },
  { label: 'Singapore (SG)', value: 'sg' },
  { label: 'Malaysia (MY)', value: 'my' },
  { label: 'Philippines (PH)', value: 'ph' },
  { label: 'Vietnam (VN)', value: 'vn' },
  { label: 'Indonesia (ID)', value: 'id' },
];

const adapterUrl = window.chatwootConfig?.adapterLazadaUrl || '';

const connectLazada = async () => {
  v$.value.$touch();
  if (v$.value.$invalid) return;

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
      region: region.value,
    });

    window.location.href = res.data.oauth_url;
  } catch {
    useAlert(t('INBOX_MGMT.ADD.LAZADA.API.ERROR_MESSAGE'));
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
    <form class="flex flex-wrap flex-col mx-0" @submit.prevent="connectLazada">
      <div class="flex-shrink-0 flex-grow-0">
        <label :class="{ error: v$.inboxName.$error }">
          {{ $t('INBOX_MGMT.ADD.LAZADA.INBOX_NAME.LABEL') }}
          <input
            v-model="inboxName"
            type="text"
            :placeholder="$t('INBOX_MGMT.ADD.LAZADA.INBOX_NAME.PLACEHOLDER')"
            @blur="v$.inboxName.$touch"
          />
          <span v-if="v$.inboxName.$error" class="message">
            {{ $t('INBOX_MGMT.ADD.LAZADA.INBOX_NAME.ERROR') }}
          </span>
        </label>
      </div>

      <div class="flex-shrink-0 flex-grow-0">
        <label :class="{ error: v$.appKey.$error }">
          {{ $t('INBOX_MGMT.ADD.LAZADA.APP_CHAT_KEY.LABEL') }}
          <input
            v-model="appKey"
            type="text"
            :placeholder="$t('INBOX_MGMT.ADD.LAZADA.APP_CHAT_KEY.PLACEHOLDER')"
            @blur="v$.appKey.$touch"
          />
          <span v-if="v$.appKey.$error" class="message">
            {{ $t('INBOX_MGMT.ADD.LAZADA.APP_CHAT_KEY.ERROR') }}
          </span>
        </label>
      </div>

      <div class="flex-shrink-0 flex-grow-0">
        <label :class="{ error: v$.appSecret.$error }">
          {{ $t('INBOX_MGMT.ADD.LAZADA.APP_CHAT_SECRET.LABEL') }}
          <input
            v-model="appSecret"
            type="password"
            :placeholder="
              $t('INBOX_MGMT.ADD.LAZADA.APP_CHAT_SECRET.PLACEHOLDER')
            "
            @blur="v$.appSecret.$touch"
          />
          <span v-if="v$.appSecret.$error" class="message">
            {{ $t('INBOX_MGMT.ADD.LAZADA.APP_CHAT_SECRET.ERROR') }}
          </span>
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
