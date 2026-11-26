// NovusWarden Vault Items & Folders Store
// Zero-Knowledge Item Decryption, Encryption & Filtering
// Enterprise Standard

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { api, RawCipher, RawSend, RawAttachment, SyncData } from '../api/client.ts';
import { useAuthStore } from './auth.ts';
import { encrypt, encryptBytes, decrypt, decryptBytes, decryptToBytes, deriveSendKey, hashSendPassword } from '../crypto/symmetric.ts';
import { getRandomBytes, bytesToUrlBase64 } from '../crypto/utils.ts';
import { syncLocaleFromAccountCulture } from '@shared/i18n.ts';

export interface DecryptedUri {
  uri: string;
  match?: number | null;
}

export interface DecryptedLogin {
  username?: string;
  password?: string;
  totp?: string;
  uris?: DecryptedUri[];
}

export interface DecryptedCard {
  cardholderName?: string;
  brand?: string;
  number?: string;
  expMonth?: string;
  expYear?: string;
  code?: string;
}

export interface DecryptedIdentity {
  title?: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  address1?: string;
  address2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  company?: string;
  email?: string;
  phone?: string;
  ssn?: string;
  username?: string;
  passportNumber?: string;
  licenseNumber?: string;
}

export interface DecryptedSshKey {
  privateKey?: string;
  publicKey?: string;
  keyFingerprint?: string;
}

export interface DecryptedBankAccount {
  bankName?: string;
  nameOnAccount?: string;
  accountType?: string;
  accountNumber?: string;
  routingNumber?: string;
  branchNumber?: string;
  pin?: string;
  swiftCode?: string;
  iban?: string;
  bankContactPhone?: string;
}

export interface DecryptedDriversLicense {
  firstName?: string;
  middleName?: string;
  lastName?: string;
  dateOfBirth?: string;
  licenseNumber?: string;
  issuingCountry?: string;
  issuingState?: string;
  issueDate?: string;
  issuingAuthority?: string;
  expirationDate?: string;
  licenseClass?: string;
}

export interface DecryptedPassport {
  surname?: string;
  givenName?: string;
  dateOfBirth?: string;
  sex?: string;
  birthPlace?: string;
  nationality?: string;
  passportNumber?: string;
  passportType?: string;
  issuingCountry?: string;
  issuingAuthority?: string;
  issueDate?: string;
  expirationDate?: string;
  nationalIdentificationNumber?: string;
}

export interface DecryptedField {
  name: string;
  value: string;
  type: number; // 0=Text, 1=Hidden, 2=Boolean, 3=Linked
  linkedId?: number | null;
}

export interface DecryptedPasswordHistory {
  lastUsedDate: string;
  password: string;
}

export interface DecryptedAttachment {
  id: string;
  fileName: string;
  size: string | number;
  sizeName?: string;
  key?: string | null;
}

export interface DecryptedCollection {
  id: string;
  organizationId: string;
  name: string;
  readOnly?: boolean;
  hidePasswords?: boolean;
}

export interface DecryptedSend extends RawSend {
  decryptedNotes?: string;
  rawKeyB64?: string;
  shareUrl?: string;
}

export interface DecryptedCipher {
  id: string;
  organizationId?: string | null;
  folderId?: string | null;
  collectionIds?: string[];
  cipherKeyStr?: string | null;
  type: number; // 1=Login, 2=SecureNote, 3=Card, 4=Identity, 5=SSHKey
  name: string;
  notes?: string;
  favorite: boolean;
  reprompt?: number;
  revisionDate?: string;
  deletedDate?: string | null;
  archivedDate?: string | null;
  fields?: DecryptedField[];
  passwordHistory?: DecryptedPasswordHistory[];
  attachments?: DecryptedAttachment[];
  login?: DecryptedLogin & { fido2Credentials?: Array<Record<string, any>> };
  card?: DecryptedCard;
  secureNote?: { type: number };
  identity?: DecryptedIdentity;
  sshKey?: DecryptedSshKey;
  bankAccount?: DecryptedBankAccount;
  driversLicense?: DecryptedDriversLicense;
  passport?: DecryptedPassport;
}

export interface DecryptedFolder {
  id: string;
  name: string;
  revisionDate?: string;
}

export interface FilterState {
  type:
    | 'all'
    | 'favorites'
    | 'login'
    | 'card'
    | 'note'
    | 'identity'
    | 'sshKey'
    | 'bankAccount'
    | 'driversLicense'
    | 'passport'
    | 'archive'
    | 'trash'
    | 'folder'
    | 'collection';
  folderId?: string;
  collectionId?: string;
}

export const useVaultStore = defineStore('vault', () => {
  const authStore = useAuthStore();

  const ciphers = ref<DecryptedCipher[]>([]);
  const folders = ref<DecryptedFolder[]>([]);
  const collections = ref<DecryptedCollection[]>([]);
  const sends = ref<DecryptedSend[]>([]);
  const isLoading = ref(false);
  const syncError = ref<string | null>(null);

  const searchQuery = ref('');
  const selectedFilter = ref<FilterState>({ type: 'all' });
  const selectedCipherId = ref<string | null>(null);

  const selectedCipher = computed(() => {
    if (!selectedCipherId.value) return null;
    return ciphers.value.find((c) => c.id === selectedCipherId.value) || null;
  });

  /**
   * Helper to decrypt safe string (returns original if null or invalid)
   */
  async function safeDecrypt(val: string | null | undefined, key: Uint8Array): Promise<string> {
    if (!val) return '';
    try {
      return await decrypt(val, key);
    } catch {
      return val;
    }
  }

  /**
   * Sync and decrypt all vault data
   */
  async function sync() {
    if (!authStore.token || !authStore.userKey) {
      return;
    }

    isLoading.value = true;
    syncError.value = null;

    try {
      let data: SyncData;
      try {
        data = await api.sync(authStore.token);
      } catch (err: any) {
        if (err?.status === 401 && (await authStore.tryRefreshToken())) {
          data = await api.sync(authStore.token!);
        } else {
          throw err;
        }
      }
      const key = authStore.userKey;

      if (data.profile) {
        authStore.profile = {
          id: data.profile.id,
          name: data.profile.name,
          email: data.profile.email,
          emailVerified: data.profile.emailVerified,
          premium: data.profile.premium,
          culture: data.profile.culture,
        };
        syncLocaleFromAccountCulture(data.profile.culture);
        await authStore.hydrateOrganizations(data.profile.organizations || []);
      }

      const decryptObjectFields = async <T extends Record<string, any>>(
        src: Record<string, any>,
        cipherKey: Uint8Array,
        fields: string[]
      ): Promise<T> => {
        const out: Record<string, string> = {};
        for (const f of fields) {
          out[f] = src[f] ? await safeDecrypt(src[f], cipherKey) : '';
        }
        return out as T;
      };

      // 1. Decrypt folders
      const decFolders: DecryptedFolder[] = [];
      for (const f of data.folders || []) {
        decFolders.push({
          id: f.id,
          name: await safeDecrypt(f.name, key),
          revisionDate: f.revisionDate,
        });
      }
      folders.value = decFolders;

      // 1b. Decrypt collections
      const decCollections: DecryptedCollection[] = [];
      for (const col of data.collections || []) {
        decCollections.push({
          id: col.id,
          organizationId: col.organizationId,
          name: await safeDecrypt(col.name, key),
          readOnly: col.readOnly,
          hidePasswords: col.hidePasswords,
        });
      }
      collections.value = decCollections;

      // 2. Decrypt ciphers in parallel (handling optional per-cipher key & org key)
      const cipherPromises = (data.ciphers || []).map(async (raw): Promise<DecryptedCipher> => {
        let baseKey = key;
        if (raw.organizationId && authStore.orgKeys[raw.organizationId]) {
          baseKey = authStore.orgKeys[raw.organizationId];
        }
        let cipherKey = baseKey;
        if (raw.key) {
          try {
            const unwrapped = await decryptToBytes(raw.key, baseKey);
            if (unwrapped.byteLength === 64) cipherKey = unwrapped;
          } catch {
            // Fall back to baseKey
          }
        }

        const name = await safeDecrypt(raw.name, cipherKey);
        const notes = raw.notes ? await safeDecrypt(raw.notes, cipherKey) : '';

        const decFields: DecryptedField[] = [];
        for (const f of raw.fields || []) {
          decFields.push({
            name: f.name ? await safeDecrypt(f.name, cipherKey) : '',
            value: f.value ? await safeDecrypt(f.value, cipherKey) : '',
            type: f.type ?? 0,
            linkedId: f.linkedId ?? null,
          });
        }

        const decHistory: DecryptedPasswordHistory[] = [];
        for (const h of raw.passwordHistory || []) {
          decHistory.push({
            lastUsedDate: h.lastUsedDate,
            password: await safeDecrypt(h.password, cipherKey),
          });
        }

        const decAttachments: DecryptedAttachment[] = [];
        for (const att of raw.attachments || []) {
          decAttachments.push({
            id: att.id,
            fileName: await safeDecrypt(att.fileName, cipherKey),
            size: att.size,
            sizeName: att.sizeName,
            key: att.key,
          });
        }

        const item: DecryptedCipher = {
          id: raw.id,
          organizationId: raw.organizationId,
          folderId: raw.folderId,
          collectionIds: raw.collectionIds || [],
          cipherKeyStr: raw.key || null,
          type: raw.type,
          name,
          notes,
          favorite: !!raw.favorite,
          reprompt: raw.reprompt || 0,
          revisionDate: raw.revisionDate,
          deletedDate: raw.deletedDate,
          archivedDate: raw.archivedDate,
          fields: decFields,
          passwordHistory: decHistory,
          attachments: decAttachments,
        };

        if (raw.type === 1 && raw.login) {
          const uris: DecryptedUri[] = [];
          for (const u of raw.login.uris || []) {
            uris.push({
              uri: await safeDecrypt(u.uri, cipherKey),
              match: u.match ?? null,
            });
          }

          item.login = {
            username: raw.login.username ? await safeDecrypt(raw.login.username, cipherKey) : '',
            password: raw.login.password ? await safeDecrypt(raw.login.password, cipherKey) : '',
            totp: raw.login.totp ? await safeDecrypt(raw.login.totp, cipherKey) : '',
            uris,
            fido2Credentials: raw.login.fido2Credentials || [],
          };
        } else if (raw.type === 3 && raw.card) {
          item.card = {
            cardholderName: raw.card.cardholderName ? await safeDecrypt(raw.card.cardholderName, cipherKey) : '',
            brand: raw.card.brand ? await safeDecrypt(raw.card.brand, cipherKey) : '',
            number: raw.card.number ? await safeDecrypt(raw.card.number, cipherKey) : '',
            expMonth: raw.card.expMonth ? await safeDecrypt(raw.card.expMonth, cipherKey) : '',
            expYear: raw.card.expYear ? await safeDecrypt(raw.card.expYear, cipherKey) : '',
            code: raw.card.code ? await safeDecrypt(raw.card.code, cipherKey) : '',
          };
        } else if (raw.type === 4 && raw.identity) {
          item.identity = {
            title: raw.identity.title ? await safeDecrypt(raw.identity.title, cipherKey) : '',
            firstName: raw.identity.firstName ? await safeDecrypt(raw.identity.firstName, cipherKey) : '',
            middleName: raw.identity.middleName ? await safeDecrypt(raw.identity.middleName, cipherKey) : '',
            lastName: raw.identity.lastName ? await safeDecrypt(raw.identity.lastName, cipherKey) : '',
            address1: raw.identity.address1 ? await safeDecrypt(raw.identity.address1, cipherKey) : '',
            address2: raw.identity.address2 ? await safeDecrypt(raw.identity.address2, cipherKey) : '',
            city: raw.identity.city ? await safeDecrypt(raw.identity.city, cipherKey) : '',
            state: raw.identity.state ? await safeDecrypt(raw.identity.state, cipherKey) : '',
            postalCode: raw.identity.postalCode ? await safeDecrypt(raw.identity.postalCode, cipherKey) : '',
            country: raw.identity.country ? await safeDecrypt(raw.identity.country, cipherKey) : '',
            company: raw.identity.company ? await safeDecrypt(raw.identity.company, cipherKey) : '',
            email: raw.identity.email ? await safeDecrypt(raw.identity.email, cipherKey) : '',
            phone: raw.identity.phone ? await safeDecrypt(raw.identity.phone, cipherKey) : '',
            ssn: raw.identity.ssn ? await safeDecrypt(raw.identity.ssn, cipherKey) : '',
            username: raw.identity.username ? await safeDecrypt(raw.identity.username, cipherKey) : '',
            passportNumber: raw.identity.passportNumber ? await safeDecrypt(raw.identity.passportNumber, cipherKey) : '',
            licenseNumber: raw.identity.licenseNumber ? await safeDecrypt(raw.identity.licenseNumber, cipherKey) : '',
          };
        } else if (raw.type === 2) {
          item.secureNote = { type: 0 };
        } else if (raw.type === 5 && raw.sshKey) {
          item.sshKey = {
            privateKey: raw.sshKey.privateKey ? await safeDecrypt(raw.sshKey.privateKey, cipherKey) : '',
            publicKey: raw.sshKey.publicKey ? await safeDecrypt(raw.sshKey.publicKey, cipherKey) : '',
            keyFingerprint: raw.sshKey.keyFingerprint ? await safeDecrypt(raw.sshKey.keyFingerprint, cipherKey) : '',
          };
        } else if (raw.type === 6 && raw.bankAccount) {
          item.bankAccount = await decryptObjectFields<DecryptedBankAccount>(raw.bankAccount, cipherKey, [
            'bankName',
            'nameOnAccount',
            'accountType',
            'accountNumber',
            'routingNumber',
            'branchNumber',
            'pin',
            'swiftCode',
            'iban',
            'bankContactPhone',
          ]);
        } else if (raw.type === 7 && raw.driversLicense) {
          item.driversLicense = await decryptObjectFields<DecryptedDriversLicense>(raw.driversLicense, cipherKey, [
            'firstName',
            'middleName',
            'lastName',
            'dateOfBirth',
            'licenseNumber',
            'issuingCountry',
            'issuingState',
            'issueDate',
            'issuingAuthority',
            'expirationDate',
            'licenseClass',
          ]);
        } else if (raw.type === 8 && raw.passport) {
          item.passport = await decryptObjectFields<DecryptedPassport>(raw.passport, cipherKey, [
            'surname',
            'givenName',
            'dateOfBirth',
            'sex',
            'birthPlace',
            'nationality',
            'passportNumber',
            'passportType',
            'issuingCountry',
            'issuingAuthority',
            'issueDate',
            'expirationDate',
            'nationalIdentificationNumber',
          ]);
        }

        return item;
      });

      ciphers.value = await Promise.all(cipherPromises);

      // 3. Decrypt Sends using each Send's wrapped key & compute Bitwarden share URL
      const decSends: DecryptedSend[] = [];
      for (const s of data.sends || []) {
        let decName = s.name;
        let decNotes = '';
        let rawKeyB64 = '';
        let decFileName = s.file?.fileName;
        if (s.key) {
          try {
            const rawSendKey = await decryptToBytes(s.key, key);
            rawKeyB64 = bytesToUrlBase64(rawSendKey);
            const sendSymKey = await deriveSendKey(rawSendKey);
            decName = await decrypt(s.name, sendSymKey);
            if (s.notes) decNotes = await decrypt(s.notes, sendSymKey).catch(() => '');
            if (s.type === 1 && s.file?.fileName) {
              decFileName = await decrypt(s.file.fileName, sendSymKey).catch(() => s.file!.fileName);
            }
          } catch {
            decName = await safeDecrypt(s.name, key);
          }
        }
        const accessPart = s.accessId || s.id;
        const shareUrl = rawKeyB64
          ? `${window.location.origin}/#/send/${accessPart}/${rawKeyB64}`
          : `${window.location.origin}/#/send/${accessPart}`;
        decSends.push({
          ...s,
          name: decName,
          decryptedNotes: decNotes,
          rawKeyB64,
          shareUrl,
          file: s.file ? { ...s.file, fileName: decFileName || s.file.fileName } : undefined,
        });
      }
      sends.value = decSends;

      // Auto-select first item if none selected
      if (!selectedCipherId.value && ciphers.value.length > 0) {
        const nonTrash = ciphers.value.filter((c) => !c.deletedDate);
        if (nonTrash.length > 0) {
          selectedCipherId.value = nonTrash[0].id;
        }
      }
    } catch (err: any) {
      syncError.value = err?.message || 'Ошибка синхронизации';
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Save (create or update) a cipher
   */
  async function saveCipher(item: Partial<DecryptedCipher>): Promise<DecryptedCipher> {
    if (!authStore.token || !authStore.userKey) {
      throw new Error('Пользователь не авторизован');
    }
    const key = authStore.userKey;

    let userId = authStore.profile?.id;
    if (!userId) {
      const profileData = await api.getAccountProfile(authStore.token);
      userId = profileData?.id || '';
      if (userId && authStore.profile) {
        authStore.profile.id = userId;
      }
    }
    if (!userId) {
      throw new Error('Не удалось определить идентификатор пользователя (encryptedFor)');
    }

    let baseEncKey = authStore.userKey;
    if (item.organizationId && authStore.orgKeys[item.organizationId]) {
      baseEncKey = authStore.orgKeys[item.organizationId];
    }
    let encKey = baseEncKey;
    if (item.cipherKeyStr) {
      try {
        const unwrapped = await decryptToBytes(item.cipherKeyStr, baseEncKey);
        if (unwrapped.byteLength === 64) encKey = unwrapped;
      } catch {
        encKey = baseEncKey;
      }
    }

    // Track Password History automatically when password changes on existing login
    const existingCipher = item.id ? ciphers.value.find((c) => c.id === item.id) : undefined;
    const historyList: DecryptedPasswordHistory[] = [...(item.passwordHistory || existingCipher?.passwordHistory || [])];
    if (
      existingCipher?.type === 1 &&
      existingCipher.login?.password &&
      item.type === 1 &&
      item.login?.password !== undefined &&
      existingCipher.login.password !== item.login.password
    ) {
      historyList.unshift({
        password: existingCipher.login.password,
        lastUsedDate: new Date().toISOString(),
      });
    }

    const encName = (await encrypt(item.name || 'Без названия', encKey)).toString();
    const encNotes = item.notes ? (await encrypt(item.notes, encKey)).toString() : null;

    const encFields = [];
    for (const f of item.fields || []) {
      if (f.name || f.value) {
        encFields.push({
          name: f.name ? (await encrypt(f.name, encKey)).toString() : null,
          value: f.value ? (await encrypt(f.value, encKey)).toString() : null,
          type: f.type ?? 0,
          linkedId: f.linkedId ?? null,
        });
      }
    }

    const encHistory = [];
    for (const h of historyList.slice(0, 10)) {
      if (h.password) {
        encHistory.push({
          lastUsedDate: h.lastUsedDate,
          password: (await encrypt(h.password, encKey)).toString(),
        });
      }
    }

    const rawPayload: Partial<RawCipher> = {
      type: item.type || 1,
      encryptedFor: userId,
      key: item.cipherKeyStr || undefined,
      organizationId: item.organizationId || undefined,
      collectionIds: item.collectionIds?.length ? item.collectionIds : undefined,
      name: encName,
      notes: encNotes,
      folderId: item.folderId || null,
      favorite: !!item.favorite,
      reprompt: item.reprompt || 0,
      fields: encFields.length ? encFields : null,
      passwordHistory: encHistory.length ? encHistory : undefined,
    };

    if (item.type === 1 && item.login) {
      const encUris = [];
      for (const u of item.login.uris || []) {
        if (u.uri) {
          encUris.push({
            uri: (await encrypt(u.uri, encKey)).toString(),
            match: u.match ?? null,
          });
        }
      }

      rawPayload.login = {
        username: item.login.username ? (await encrypt(item.login.username, encKey)).toString() : null,
        password: item.login.password ? (await encrypt(item.login.password, encKey)).toString() : null,
        totp: item.login.totp ? (await encrypt(item.login.totp, encKey)).toString() : null,
        uris: encUris,
        fido2Credentials: item.login.fido2Credentials || existingCipher?.login?.fido2Credentials,
      };
    } else if (item.type === 3 && item.card) {
      rawPayload.card = {
        cardholderName: item.card.cardholderName ? (await encrypt(item.card.cardholderName, encKey)).toString() : null,
        brand: item.card.brand ? (await encrypt(item.card.brand, encKey)).toString() : null,
        number: item.card.number ? (await encrypt(item.card.number, encKey)).toString() : null,
        expMonth: item.card.expMonth ? (await encrypt(item.card.expMonth, encKey)).toString() : null,
        expYear: item.card.expYear ? (await encrypt(item.card.expYear, encKey)).toString() : null,
        code: item.card.code ? (await encrypt(item.card.code, encKey)).toString() : null,
      };
    } else if (item.type === 4 && item.identity) {
      const encOpt = async (val?: string | null) =>
        val ? (await encrypt(val, encKey)).toString() : null;
      rawPayload.identity = {
        title: await encOpt(item.identity.title),
        firstName: await encOpt(item.identity.firstName),
        middleName: await encOpt(item.identity.middleName),
        lastName: await encOpt(item.identity.lastName),
        address1: await encOpt(item.identity.address1),
        address2: await encOpt(item.identity.address2),
        city: await encOpt(item.identity.city),
        state: await encOpt(item.identity.state),
        postalCode: await encOpt(item.identity.postalCode),
        country: await encOpt(item.identity.country),
        company: await encOpt(item.identity.company),
        email: await encOpt(item.identity.email),
        phone: await encOpt(item.identity.phone),
        ssn: await encOpt(item.identity.ssn),
        username: await encOpt(item.identity.username),
        passportNumber: await encOpt(item.identity.passportNumber),
        licenseNumber: await encOpt(item.identity.licenseNumber),
      };
    } else if (item.type === 2) {
      rawPayload.secureNote = { type: 0 };
    } else if (item.type === 5 && item.sshKey) {
      rawPayload.sshKey = {
        privateKey: item.sshKey.privateKey ? (await encrypt(item.sshKey.privateKey, encKey)).toString() : null,
        publicKey: item.sshKey.publicKey ? (await encrypt(item.sshKey.publicKey, encKey)).toString() : null,
        keyFingerprint: item.sshKey.keyFingerprint
          ? (await encrypt(item.sshKey.keyFingerprint, encKey)).toString()
          : null,
      };
    } else if (item.type === 6 && item.bankAccount) {
      const encOpt = async (val?: string | null) => (val ? (await encrypt(val, encKey)).toString() : null);
      rawPayload.bankAccount = {
        bankName: await encOpt(item.bankAccount.bankName),
        nameOnAccount: await encOpt(item.bankAccount.nameOnAccount),
        accountType: await encOpt(item.bankAccount.accountType),
        accountNumber: await encOpt(item.bankAccount.accountNumber),
        routingNumber: await encOpt(item.bankAccount.routingNumber),
        branchNumber: await encOpt(item.bankAccount.branchNumber),
        pin: await encOpt(item.bankAccount.pin),
        swiftCode: await encOpt(item.bankAccount.swiftCode),
        iban: await encOpt(item.bankAccount.iban),
        bankContactPhone: await encOpt(item.bankAccount.bankContactPhone),
      };
    } else if (item.type === 7 && item.driversLicense) {
      const encOpt = async (val?: string | null) => (val ? (await encrypt(val, encKey)).toString() : null);
      rawPayload.driversLicense = {
        firstName: await encOpt(item.driversLicense.firstName),
        middleName: await encOpt(item.driversLicense.middleName),
        lastName: await encOpt(item.driversLicense.lastName),
        dateOfBirth: await encOpt(item.driversLicense.dateOfBirth),
        licenseNumber: await encOpt(item.driversLicense.licenseNumber),
        issuingCountry: await encOpt(item.driversLicense.issuingCountry),
        issuingState: await encOpt(item.driversLicense.issuingState),
        issueDate: await encOpt(item.driversLicense.issueDate),
        issuingAuthority: await encOpt(item.driversLicense.issuingAuthority),
        expirationDate: await encOpt(item.driversLicense.expirationDate),
        licenseClass: await encOpt(item.driversLicense.licenseClass),
      };
    } else if (item.type === 8 && item.passport) {
      const encOpt = async (val?: string | null) => (val ? (await encrypt(val, encKey)).toString() : null);
      rawPayload.passport = {
        surname: await encOpt(item.passport.surname),
        givenName: await encOpt(item.passport.givenName),
        dateOfBirth: await encOpt(item.passport.dateOfBirth),
        sex: await encOpt(item.passport.sex),
        birthPlace: await encOpt(item.passport.birthPlace),
        nationality: await encOpt(item.passport.nationality),
        passportNumber: await encOpt(item.passport.passportNumber),
        passportType: await encOpt(item.passport.passportType),
        issuingCountry: await encOpt(item.passport.issuingCountry),
        issuingAuthority: await encOpt(item.passport.issuingAuthority),
        issueDate: await encOpt(item.passport.issueDate),
        expirationDate: await encOpt(item.passport.expirationDate),
        nationalIdentificationNumber: await encOpt(item.passport.nationalIdentificationNumber),
      };
    }

    let savedRaw: RawCipher;
    if (item.id) {
      savedRaw = await api.updateCipher(authStore.token, item.id, rawPayload);
    } else {
      savedRaw = await api.createCipher(authStore.token, rawPayload);
    }

    const savedDecrypted: DecryptedCipher = {
      ...item,
      id: savedRaw.id,
      name: item.name || 'Без названия',
      notes: item.notes || '',
      favorite: !!item.favorite,
      passwordHistory: historyList.slice(0, 10),
      attachments: existingCipher?.attachments || [],
      revisionDate: savedRaw.revisionDate || new Date().toISOString(),
    } as DecryptedCipher;

    const existingIdx = ciphers.value.findIndex((c) => c.id === savedRaw.id);
    if (existingIdx !== -1) {
      ciphers.value[existingIdx] = savedDecrypted;
    } else {
      ciphers.value.unshift(savedDecrypted);
    }

    selectedCipherId.value = savedDecrypted.id;
    return savedDecrypted;
  }

  /**
   * Move cipher to trash
   */
  async function deleteCipher(id: string) {
    if (!authStore.token) return;
    await api.deleteCipher(authStore.token, id);
    const item = ciphers.value.find((c) => c.id === id);
    if (item) {
      item.deletedDate = new Date().toISOString();
    }
  }

  /**
   * Permanently delete cipher
   */
  async function permanentDeleteCipher(id: string) {
    if (!authStore.token) return;
    await api.permanentDeleteCipher(authStore.token, id);
    ciphers.value = ciphers.value.filter((c) => c.id !== id);
    if (selectedCipherId.value === id) {
      selectedCipherId.value = ciphers.value[0]?.id || null;
    }
  }

  /**
   * Restore cipher from trash
   */
  async function restoreCipher(id: string) {
    if (!authStore.token) return;
    await api.restoreCipher(authStore.token, id);
    const item = ciphers.value.find((c) => c.id === id);
    if (item) {
      item.deletedDate = null;
    }
  }

  async function archiveCipher(id: string) {
    if (!authStore.token) return;
    await api.archiveCipher(authStore.token, id);
    const item = ciphers.value.find((c) => c.id === id);
    if (item) {
      item.archivedDate = new Date().toISOString();
    }
  }

  async function unarchiveCipher(id: string) {
    if (!authStore.token) return;
    await api.unarchiveCipher(authStore.token, id);
    const item = ciphers.value.find((c) => c.id === id);
    if (item) {
      item.archivedDate = null;
    }
  }

  async function shareCipherToOrg(id: string, organizationId: string, collectionIds: string[]) {
    if (!authStore.token || !authStore.userKey) return;
    const item = ciphers.value.find((c) => c.id === id);
    if (!item) return;
    const orgKey = authStore.orgKeys[organizationId];
    if (!orgKey) {
      throw new Error('Ключ выбранной организации недоступен (требуется перевход или подтверждение членства)');
    }

    const encName = (await encrypt(item.name || 'Без названия', orgKey)).toString();
    const encNotes = item.notes ? (await encrypt(item.notes, orgKey)).toString() : null;
    const payload: Partial<RawCipher> = {
      type: item.type,
      organizationId,
      folderId: item.folderId ?? null,
      favorite: !!item.favorite,
      reprompt: item.reprompt ?? 0,
      name: encName,
      notes: encNotes,
    };

    if (item.type === 1 && item.login) {
      const uris = [];
      for (const u of item.login.uris || []) {
        if (u.uri.trim()) uris.push({ uri: (await encrypt(u.uri, orgKey)).toString(), match: u.match ?? null });
      }
      payload.login = {
        username: item.login.username ? (await encrypt(item.login.username, orgKey)).toString() : null,
        password: item.login.password ? (await encrypt(item.login.password, orgKey)).toString() : null,
        totp: item.login.totp ? (await encrypt(item.login.totp, orgKey)).toString() : null,
        uris,
      };
    } else if (item.type === 2) {
      payload.secureNote = { type: 0 };
    }

    await api.shareCipher(authStore.token, id, payload, collectionIds);
    await sync();
  }

  async function updateCipherCollections(id: string, collectionIds: string[]) {
    if (!authStore.token) return;
    await api.updateCipherCollections(authStore.token, id, collectionIds);
    const item = ciphers.value.find((c) => c.id === id);
    if (item) {
      item.collectionIds = [...collectionIds];
    }
  }

  /**
   * Toggle favorite
   */
  async function toggleFavorite(id: string) {
    const item = ciphers.value.find((c) => c.id === id);
    if (!item || !authStore.token) return;
    const prevFav = item.favorite;
    const newFav = !prevFav;
    item.favorite = newFav;
    try {
      await api.toggleFavorite(authStore.token, id, item.folderId ?? null, newFav);
    } catch (err) {
      item.favorite = prevFav;
      throw err;
    }
  }

  /**
   * Create folder
   */
  async function createFolder(name: string) {
    if (!authStore.token || !authStore.userKey) return;
    const encName = (await encrypt(name.trim(), authStore.userKey)).toString();
    const res = await api.createFolder(authStore.token, encName);
    folders.value.push({
      id: res.id,
      name: name.trim(),
    });
  }

  /**
   * Rename folder
   */
  async function renameFolder(id: string, newName: string) {
    if (!authStore.token || !authStore.userKey) return;
    const cleanName = newName.trim();
    if (!cleanName) return;
    const encName = (await encrypt(cleanName, authStore.userKey)).toString();
    await api.updateFolder(authStore.token, id, encName);
    const f = folders.value.find((f) => f.id === id);
    if (f) {
      f.name = cleanName;
    }
  }

  /**
   * Delete folder
   */
  async function deleteFolder(id: string) {
    if (!authStore.token) return;
    await api.deleteFolder(authStore.token, id);
    folders.value = folders.value.filter((f) => f.id !== id);
  }

  /**
   * Create a Text Send with Bitwarden-compatible per-send key derivation
   */
  async function createTextSend(opts: {
    name: string;
    text: string;
    notes?: string;
    password?: string;
    hideEmail?: boolean;
    deletionDays: number;
    maxAccessCount?: number | null;
    hidden?: boolean;
  }): Promise<DecryptedSend> {
    if (!authStore.token || !authStore.userKey) {
      throw new Error('Пользователь не авторизован');
    }
    const rawSendKey = getRandomBytes(16);
    const wrappedKey = (await encrypt(rawSendKey, authStore.userKey)).toString();
    const rawKeyB64 = bytesToUrlBase64(rawSendKey);
    const sendSymKey = await deriveSendKey(rawSendKey);

    const encName = (await encrypt(opts.name.trim(), sendSymKey)).toString();
    const encText = (await encrypt(opts.text, sendSymKey)).toString();
    const encNotes = opts.notes?.trim() ? (await encrypt(opts.notes.trim(), sendSymKey)).toString() : undefined;
    const passwordHash = opts.password?.trim() ? await hashSendPassword(opts.password.trim()) : undefined;
    const deletionDate = new Date(Date.now() + opts.deletionDays * 86400000).toISOString();

    const created = await api.createSend(authStore.token, {
      type: 0,
      key: wrappedKey,
      name: encName,
      notes: encNotes,
      text: { text: encText, hidden: !!opts.hidden },
      password: passwordHash,
      hideEmail: !!opts.hideEmail,
      maxAccessCount: opts.maxAccessCount || null,
      deletionDate,
      disabled: false,
    });

    const accessPart = created.accessId || created.id;
    const decrypted: DecryptedSend = {
      ...created,
      name: opts.name.trim(),
      decryptedNotes: opts.notes?.trim() || '',
      rawKeyB64,
      shareUrl: `${window.location.origin}/#/send/${accessPart}/${rawKeyB64}`,
    };
    sends.value.unshift(decrypted);
    return decrypted;
  }

  /**
   * Create a File Send with Bitwarden-compatible per-send key derivation & binary EncType 2 encryption
   */
  async function createFileSend(opts: {
    name: string;
    file: File;
    notes?: string;
    password?: string;
    hideEmail?: boolean;
    deletionDays: number;
    maxAccessCount?: number | null;
  }): Promise<DecryptedSend> {
    if (!authStore.token || !authStore.userKey) {
      throw new Error('Пользователь не авторизован');
    }
    const rawSendKey = getRandomBytes(16);
    const wrappedKey = (await encrypt(rawSendKey, authStore.userKey)).toString();
    const rawKeyB64 = bytesToUrlBase64(rawSendKey);
    const sendSymKey = await deriveSendKey(rawSendKey);

    const encName = (await encrypt(opts.name.trim(), sendSymKey)).toString();
    const encFileName = (await encrypt(opts.file.name, sendSymKey)).toString();
    const encNotes = opts.notes?.trim() ? (await encrypt(opts.notes.trim(), sendSymKey)).toString() : undefined;
    const passwordHash = opts.password?.trim() ? await hashSendPassword(opts.password.trim()) : undefined;
    const plainBytes = new Uint8Array(await opts.file.arrayBuffer());
    const encryptedBytes = await encryptBytes(plainBytes, sendSymKey);
    const encryptedBlob = new Blob([encryptedBytes as BlobPart], { type: 'application/octet-stream' });
    const deletionDate = new Date(Date.now() + opts.deletionDays * 86400000).toISOString();

    const created = await api.createFileSend(
      authStore.token,
      {
        type: 1,
        key: wrappedKey,
        name: encName,
        notes: encNotes,
        file: { fileName: encFileName },
        fileLength: encryptedBytes.byteLength,
        password: passwordHash,
        hideEmail: !!opts.hideEmail,
        maxAccessCount: opts.maxAccessCount || null,
        deletionDate,
        disabled: false,
      },
      encryptedBlob,
      encFileName
    );

    const accessPart = created.accessId || created.id;
    const decrypted: DecryptedSend = {
      ...created,
      name: opts.name.trim(),
      decryptedNotes: opts.notes?.trim() || '',
      rawKeyB64,
      shareUrl: `${window.location.origin}/#/send/${accessPart}/${rawKeyB64}`,
      file: created.file ? { ...created.file, fileName: opts.file.name } : undefined,
    };
    sends.value.unshift(decrypted);
    return decrypted;
  }

  async function toggleSendDisabled(send: DecryptedSend) {
    if (!authStore.token || !authStore.userKey || !send.key) return;
    const rawSendKey = await decryptToBytes(send.key, authStore.userKey);
    const sendSymKey = await deriveSendKey(rawSendKey);
    const encName = (await encrypt(send.name, sendSymKey)).toString();
    const updated = await api.updateSend(authStore.token, send.id, {
      type: send.type,
      key: send.key,
      name: encName,
      notes: send.notes,
      text: send.text,
      file: send.file,
      deletionDate: send.deletionDate || new Date(Date.now() + 7 * 86400000).toISOString(),
      maxAccessCount: send.maxAccessCount || null,
      hideEmail: !!send.hideEmail,
      disabled: !send.disabled,
    });
    const idx = sends.value.findIndex((s) => s.id === send.id);
    if (idx !== -1) {
      sends.value[idx] = { ...sends.value[idx], ...updated, name: send.name };
    }
  }

  async function bulkDelete(ids: string[], permanent = false) {
    if (!authStore.token || ids.length === 0) return;
    await api.bulkDeleteCiphers(authStore.token, ids, permanent);
    if (permanent) {
      ciphers.value = ciphers.value.filter((c) => !ids.includes(c.id));
    } else {
      const nowIso = new Date().toISOString();
      ciphers.value.forEach((c) => {
        if (ids.includes(c.id)) c.deletedDate = nowIso;
      });
    }
  }

  async function bulkRestore(ids: string[]) {
    if (!authStore.token || ids.length === 0) return;
    await api.bulkRestoreCiphers(authStore.token, ids);
    ciphers.value.forEach((c) => {
      if (ids.includes(c.id)) c.deletedDate = null;
    });
  }

  async function bulkMoveFolder(ids: string[], folderId: string | null) {
    if (!authStore.token || ids.length === 0) return;
    await api.bulkMoveCiphers(authStore.token, ids, folderId);
    ciphers.value.forEach((c) => {
      if (ids.includes(c.id)) c.folderId = folderId || null;
    });
  }

  async function emptyTrash() {
    const trashIds = ciphers.value.filter((c) => !!c.deletedDate).map((c) => c.id);
    if (trashIds.length === 0) return;
    await bulkDelete(trashIds, true);
  }

  async function uploadAttachment(cipherId: string, file: File) {
    if (!authStore.token || !authStore.userKey) throw new Error('Пользователь не авторизован');
    const cipher = ciphers.value.find((c) => c.id === cipherId);
    const baseKey =
      (cipher?.organizationId && authStore.orgKeys[cipher.organizationId]) || authStore.userKey;
    let cipherKey = baseKey;
    if (cipher?.cipherKeyStr) {
      try {
        cipherKey = await decryptToBytes(cipher.cipherKeyStr, baseKey);
      } catch { /* fallback */ }
    }
    const attKey = getRandomBytes(64);
    const encFileKey = (await encrypt(attKey, cipherKey)).toString();
    const encFileName = (await encrypt(file.name, cipherKey)).toString();
    const plainBytes = new Uint8Array(await file.arrayBuffer());
    const encBytes = await encryptBytes(plainBytes, attKey);
    const blob = new Blob([encBytes as BlobPart], { type: 'application/octet-stream' });

    await api.uploadCipherAttachment(authStore.token, cipherId, blob, encFileName, encFileKey);
    await sync();
  }

  async function downloadAttachment(cipher: DecryptedCipher, att: DecryptedAttachment) {
    if (!authStore.token || !authStore.userKey) return;
    const meta = await api.getCipherAttachment(authStore.token, cipher.id, att.id);
    if (!meta.url) throw new Error('URL вложения отсутствует');
    const resp = await fetch(meta.url);
    if (!resp.ok) throw new Error('Не удалось скачать вложение');
    const encBuf = new Uint8Array(await resp.arrayBuffer());

    const baseKey =
      (cipher.organizationId && authStore.orgKeys[cipher.organizationId]) || authStore.userKey;
    let cipherKey = baseKey;
    if (cipher.cipherKeyStr) {
      try {
        cipherKey = await decryptToBytes(cipher.cipherKeyStr, baseKey);
      } catch { /* fallback */ }
    }
    const keyStr = meta.key || att.key;
    const fileKey = keyStr ? await decryptToBytes(keyStr, cipherKey) : cipherKey;
    const plain = await decryptBytes(encBuf, fileKey);
    const blob = new Blob([plain as BlobPart]);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = att.fileName || 'attachment.bin';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function deleteAttachment(cipherId: string, attachmentId: string) {
    if (!authStore.token) return;
    await api.deleteCipherAttachment(authStore.token, cipherId, attachmentId);
    await sync();
  }

  async function deleteSend(id: string) {
    if (!authStore.token) return;
    await api.deleteSend(authStore.token, id);
    sends.value = sends.value.filter((s) => s.id !== id);
  }

  async function ensureUserId(): Promise<string> {
    if (!authStore.token) {
      throw new Error('Пользователь не авторизован');
    }
    let userId = authStore.profile?.id;
    if (!userId) {
      const p = await api.getAccountProfile(authStore.token);
      userId = p?.id || '';
      if (userId && authStore.profile) authStore.profile.id = userId;
    }
    if (!userId) {
      throw new Error('Не удалось определить ID пользователя для импорта');
    }
    return userId;
  }

  /**
   * Import unencrypted Bitwarden / NovusWarden JSON export and encrypt locally before upload
   */
  async function importVaultJson(rawJsonText: string): Promise<{ importedCiphers: number; importedFolders: number }> {
    if (!authStore.token || !authStore.userKey) {
      throw new Error('Пользователь не авторизован');
    }
    const parsed = JSON.parse(rawJsonText);
    if (parsed?.encrypted) {
      throw new Error('Поддерживается импорт только незашифрованного JSON (encrypted: false)');
    }
    const items = Array.isArray(parsed?.items) ? parsed.items : [];
    const srcFolders = Array.isArray(parsed?.folders) ? parsed.folders : [];

    const userId = await ensureUserId();

    const key = authStore.userKey;
    const encOpt = async (v?: string | null) => (v ? (await encrypt(String(v), key)).toString() : null);

    const folderIndexById = new Map<string, number>();
    const foldersPayload: Array<{ name: string }> = [];
    for (let i = 0; i < srcFolders.length; i++) {
      const f = srcFolders[i];
      if (f?.name) {
        folderIndexById.set(f.id || String(i), foldersPayload.length);
        foldersPayload.push({ name: (await encrypt(String(f.name), key)).toString() });
      }
    }

    const ciphersPayload: Partial<RawCipher>[] = [];
    const folderRelationships: Array<{ key: number; value: number }> = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item) continue;

      const cType = Number(item.type) || 1;
      const cipherEntry: Partial<RawCipher> = {
        type: cType,
        encryptedFor: userId,
        name: (await encrypt(String(item.name || 'Без названия'), key)).toString(),
        notes: await encOpt(item.notes),
        favorite: !!item.favorite,
        reprompt: item.reprompt || 0,
      };

      if (cType === 1 && item.login) {
        const uris = [];
        for (const u of item.login.uris || []) {
          if (u?.uri) {
            uris.push({ uri: (await encrypt(String(u.uri), key)).toString(), match: u.match ?? null });
          }
        }
        cipherEntry.login = {
          username: await encOpt(item.login.username),
          password: await encOpt(item.login.password),
          totp: await encOpt(item.login.totp),
          uris,
        };
      } else if (cType === 2) {
        cipherEntry.secureNote = { type: item.secureNote?.type ?? 0 };
      } else if (cType === 3 && item.card) {
        cipherEntry.card = {
          cardholderName: await encOpt(item.card.cardholderName),
          brand: await encOpt(item.card.brand),
          number: await encOpt(item.card.number),
          expMonth: await encOpt(item.card.expMonth),
          expYear: await encOpt(item.card.expYear),
          code: await encOpt(item.card.code),
        };
      } else if (cType === 4 && item.identity) {
        cipherEntry.identity = {
          title: await encOpt(item.identity.title),
          firstName: await encOpt(item.identity.firstName),
          middleName: await encOpt(item.identity.middleName),
          lastName: await encOpt(item.identity.lastName),
          address1: await encOpt(item.identity.address1),
          address2: await encOpt(item.identity.address2),
          city: await encOpt(item.identity.city),
          state: await encOpt(item.identity.state),
          postalCode: await encOpt(item.identity.postalCode),
          country: await encOpt(item.identity.country),
          company: await encOpt(item.identity.company),
          email: await encOpt(item.identity.email),
          phone: await encOpt(item.identity.phone),
          ssn: await encOpt(item.identity.ssn),
          username: await encOpt(item.identity.username),
          passportNumber: await encOpt(item.identity.passportNumber),
          licenseNumber: await encOpt(item.identity.licenseNumber),
        };
      } else if (cType === 5 && item.sshKey) {
        cipherEntry.sshKey = {
          privateKey: await encOpt(item.sshKey.privateKey),
          publicKey: await encOpt(item.sshKey.publicKey),
          keyFingerprint: item.sshKey.keyFingerprint || null,
        };
      }

      const cipherIdx = ciphersPayload.length;
      ciphersPayload.push(cipherEntry);
      if (item.folderId && folderIndexById.has(item.folderId)) {
        folderRelationships.push({ key: cipherIdx, value: folderIndexById.get(item.folderId)! });
      }
    }

    await api.importCiphers(authStore.token, {
      ciphers: ciphersPayload,
      folders: foldersPayload,
      folderRelationships,
    });

    await sync();
    return { importedCiphers: ciphersPayload.length, importedFolders: foldersPayload.length };
  }

  /**
   * RFC-4180 CSV parser supporting quoted multiline fields and Bitwarden/Chrome/LastPass columns
   */
  function parseCsvRows(text: string): string[][] {
    const rows: string[][] = [];
    let row: string[] = [];
    let cell = '';
    let inQuotes = false;
    const clean = text.replace(/^\uFEFF/, '');

    for (let i = 0; i < clean.length; i++) {
      const ch = clean[i];
      if (inQuotes) {
        if (ch === '"' && clean[i + 1] === '"') {
          cell += '"';
          i++;
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          cell += ch;
        }
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        row.push(cell);
        cell = '';
      } else if (ch === '\r' && clean[i + 1] === '\n') {
        row.push(cell);
        rows.push(row);
        row = [];
        cell = '';
        i++;
      } else if (ch === '\n' || ch === '\r') {
        row.push(cell);
        rows.push(row);
        row = [];
        cell = '';
      } else {
        cell += ch;
      }
    }
    if (cell.length > 0 || row.length > 0) {
      row.push(cell);
      rows.push(row);
    }
    return rows.filter((r) => r.some((v) => v.trim() !== ''));
  }

  async function importVaultCsv(rawCsvText: string): Promise<{ importedCiphers: number; importedFolders: number }> {
    if (!authStore.token || !authStore.userKey) {
      throw new Error('Пользователь не авторизован');
    }
    const rows = parseCsvRows(rawCsvText);
    if (rows.length < 2) {
      throw new Error('CSV файл пуст или не содержит строк данных');
    }

    const headerMap = new Map<string, number>();
    rows[0].forEach((col, idx) => headerMap.set(col.trim().toLowerCase(), idx));
    const col = (r: string[], ...names: string[]): string => {
      for (const n of names) {
        const idx = headerMap.get(n);
        if (idx !== undefined && r[idx] !== undefined) return r[idx].trim();
      }
      return '';
    };

    const userId = await ensureUserId();
    const key = authStore.userKey;
    const encOpt = async (v?: string | null) => (v ? (await encrypt(String(v), key)).toString() : null);

    const folderIndexByName = new Map<string, number>();
    const foldersPayload: Array<{ name: string }> = [];
    const ciphersPayload: Partial<RawCipher>[] = [];
    const folderRelationships: Array<{ key: number; value: number }> = [];

    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      const rawName = col(r, 'name', 'title') || col(r, 'login_uri', 'url', 'uri') || `Запись ${i}`;
      const rawNotes = col(r, 'notes', 'note', 'extra');
      const rawType = col(r, 'type').toLowerCase();
      const rawFolder = col(r, 'folder', 'grouping');
      const favoriteVal = col(r, 'favorite');
      const isFavorite = favoriteVal === '1' || favoriteVal.toLowerCase() === 'true';
      const reprompt = Number(col(r, 'reprompt')) || 0;

      let cType = 1;
      if (rawType === 'note' || rawType === '2') cType = 2;
      else if (rawType === 'card' || rawType === '3') cType = 3;
      else if (rawType === 'identity' || rawType === '4') cType = 4;
      else if (rawType === '5' || rawType === 'ssh' || rawType === 'sshkey') cType = 5;

      const entry: Partial<RawCipher> = {
        type: cType,
        encryptedFor: userId,
        name: (await encrypt(rawName, key)).toString(),
        notes: await encOpt(rawNotes),
        favorite: isFavorite,
        reprompt,
      };

      if (cType === 2) {
        entry.secureNote = { type: 0 };
      } else {
        const uri = col(r, 'login_uri', 'url', 'uri');
        const username = col(r, 'login_username', 'username');
        const password = col(r, 'login_password', 'password');
        const totp = col(r, 'login_totp', 'totp');
        entry.login = {
          username: await encOpt(username),
          password: await encOpt(password),
          totp: await encOpt(totp),
          uris: uri ? [{ uri: (await encrypt(uri, key)).toString(), match: null }] : [],
        };
      }

      const cipherIdx = ciphersPayload.length;
      ciphersPayload.push(entry);

      if (rawFolder) {
        let folderIdx = folderIndexByName.get(rawFolder);
        if (folderIdx === undefined) {
          folderIdx = foldersPayload.length;
          folderIndexByName.set(rawFolder, folderIdx);
          foldersPayload.push({ name: (await encrypt(rawFolder, key)).toString() });
        }
        folderRelationships.push({ key: cipherIdx, value: folderIdx });
      }
    }

    await api.importCiphers(authStore.token, {
      ciphers: ciphersPayload,
      folders: foldersPayload,
      folderRelationships,
    });

    await sync();
    return { importedCiphers: ciphersPayload.length, importedFolders: foldersPayload.length };
  }

  /**
   * Filtered list of ciphers
   */
  const filteredCiphers = computed(() => {
    let list = ciphers.value;
    const f = selectedFilter.value;

    // Filter by category/archive/trash
    if (f.type === 'trash') {
      list = list.filter((c) => !!c.deletedDate);
    } else if (f.type === 'archive') {
      list = list.filter((c) => !c.deletedDate && !!c.archivedDate);
    } else {
      list = list.filter((c) => !c.deletedDate && !c.archivedDate);

      if (f.type === 'favorites') {
        list = list.filter((c) => c.favorite);
      } else if (f.type === 'login') {
        list = list.filter((c) => c.type === 1);
      } else if (f.type === 'card') {
        list = list.filter((c) => c.type === 3);
      } else if (f.type === 'note') {
        list = list.filter((c) => c.type === 2);
      } else if (f.type === 'identity') {
        list = list.filter((c) => c.type === 4);
      } else if (f.type === 'sshKey') {
        list = list.filter((c) => c.type === 5);
      } else if (f.type === 'bankAccount') {
        list = list.filter((c) => c.type === 6);
      } else if (f.type === 'driversLicense') {
        list = list.filter((c) => c.type === 7);
      } else if (f.type === 'passport') {
        list = list.filter((c) => c.type === 8);
      } else if (f.type === 'folder' && f.folderId) {
        list = list.filter((c) => c.folderId === f.folderId);
      } else if (f.type === 'collection' && f.collectionId) {
        list = list.filter((c) => c.collectionIds?.includes(f.collectionId!));
      }
    }

    // Filter by search query
    const q = searchQuery.value.trim().toLowerCase();
    if (q) {
      list = list.filter((c) => {
        const matchName = c.name.toLowerCase().includes(q);
        const matchUsername = c.login?.username?.toLowerCase().includes(q) || false;
        const matchNotes = c.notes?.toLowerCase().includes(q) || false;
        const matchUri = c.login?.uris?.some((u) => u.uri.toLowerCase().includes(q)) || false;
        const matchSsh = c.sshKey?.keyFingerprint?.toLowerCase().includes(q) || false;
        return matchName || matchUsername || matchNotes || matchUri || matchSsh;
      });
    }

    // Sort: favorites first, then alphabetically by name
    return list.slice().sort((a, b) => {
      if (a.favorite && !b.favorite) return -1;
      if (!a.favorite && b.favorite) return 1;
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    });
  });

  /**
   * Counts for badge counters
   */
  const counts = computed(() => {
    const active = ciphers.value.filter((c) => !c.deletedDate && !c.archivedDate);
    return {
      total: active.length,
      favorites: active.filter((c) => c.favorite).length,
      logins: active.filter((c) => c.type === 1).length,
      cards: active.filter((c) => c.type === 3).length,
      notes: active.filter((c) => c.type === 2).length,
      identities: active.filter((c) => c.type === 4).length,
      sshKeys: active.filter((c) => c.type === 5).length,
      bankAccounts: active.filter((c) => c.type === 6).length,
      driversLicenses: active.filter((c) => c.type === 7).length,
      passports: active.filter((c) => c.type === 8).length,
      archived: ciphers.value.filter((c) => !c.deletedDate && !!c.archivedDate).length,
      trash: ciphers.value.filter((c) => !!c.deletedDate).length,
    };
  });

  return {
    ciphers,
    folders,
    collections,
    sends,
    isLoading,
    syncError,
    searchQuery,
    selectedFilter,
    selectedCipherId,
    selectedCipher,
    filteredCiphers,
    counts,
    sync,
    saveCipher,
    deleteCipher,
    permanentDeleteCipher,
    restoreCipher,
    archiveCipher,
    unarchiveCipher,
    shareCipherToOrg,
    updateCipherCollections,
    bulkDelete,
    bulkRestore,
    bulkMoveFolder,
    emptyTrash,
    uploadAttachment,
    downloadAttachment,
    deleteAttachment,
    toggleFavorite,
    createFolder,
    renameFolder,
    deleteFolder,
    createTextSend,
    createFileSend,
    toggleSendDisabled,
    deleteSend,
    importVaultJson,
    importVaultCsv,
  };
});

