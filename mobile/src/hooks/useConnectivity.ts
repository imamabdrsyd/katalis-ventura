import { useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';

interface NetInfoState {
  isConnected: boolean;
  type: string;
}

export function useConnectivity(): NetInfoState {
  const [state, setState] = useState<NetInfoState>({
    isConnected: true,
    type: 'unknown',
  });

  useEffect(() => {
    // Get initial state
    NetInfo.fetch().then((netState) => {
      setState({
        isConnected: netState.isConnected ?? false,
        type: netState.type,
      });
    });

    // Subscribe to changes
    const unsubscribe = NetInfo.addEventListener((netState) => {
      setState({
        isConnected: netState.isConnected ?? false,
        type: netState.type,
      });
    });

    return () => unsubscribe();
  }, []);

  return state;
}
