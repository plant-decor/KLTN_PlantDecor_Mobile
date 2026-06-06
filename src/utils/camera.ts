import { useCameraStore } from '../stores';

export const launchInAppCamera = async (navigation: any): Promise<any> => {
  return new Promise((resolve) => {
    useCameraStore.getState().setResolve(resolve);
    navigation.navigate('AppCamera');
  });
};
