import { Audio } from 'expo-av';

export const playPopUpSound = async () => {
  try {
    const { sound } = await Audio.Sound.createAsync(
      require('../../assets/pop-up-sound.mp3')
    );
    await sound.playAsync();
    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish) {
        sound.unloadAsync().catch(() => {});
      }
    });
  } catch {}
};
