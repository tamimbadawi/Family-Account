import { getBanks, getManagers, getOffers } from '../market';
import type { Bank, Fund, Manager, Offer } from '../market/types';
import {
  findBankForOffer,
  findBankProducts,
  findManagerForFund,
} from './index';

/**
 * Finds the Bank for an offer, loading banks if not provided.
 */
export async function getBankForOffer(
  offer: Offer,
  banks?: Bank[]
): Promise<Bank | null> {
  const bankList = banks || (await getBanks());
  return findBankForOffer(offer, bankList);
}

/**
 * Finds the Manager for a fund by managerAr, loading managers if not provided.
 */
export async function getManagerForFund(
  fund: Fund,
  managers?: Manager[]
): Promise<Manager | null> {
  const managerList = managers || (await getManagers());
  return findManagerForFund(fund, managerList);
}

/**
 * Gets all products of a bank, loading offers if not provided.
 */
export async function getBankProducts(
  bankCode: string,
  offers?: Offer[]
): Promise<Offer[]> {
  const offerList = offers || (await getOffers());
  return findBankProducts(bankCode, offerList);
}
