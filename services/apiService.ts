/* eslint-disable @typescript-eslint/no-explicit-any */
import axios, {
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  AxiosError,
} from 'axios';
import moment from 'moment';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {Alert} from 'react-native';
import {API_BASE_URL} from './key';

interface ErrorResponse {
  errors?: Array<{
    msg: string;
  }>;
}

class ApiService {
  private axiosInstance: AxiosInstance;
  private token: string | null;

  constructor() {
    this.token = null;
    this.initializeToken();

    // Create an Axios instance
    this.axiosInstance = axios.create({
      baseURL: API_BASE_URL, // Set your API base URL
      headers: {
        'Content-Type': 'application/json',
        'x-client-time': this.getFormattedDate(), // Add client date header
      },
    });

    // Add a request interceptor to attach the Bearer token and update client time
    this.axiosInstance.interceptors.request.use(
      async (config: any) => {
        // Update client time for each request
        config.headers['x-client-time'] = this.getFormattedDate();

        // Get the latest token from AsyncStorage
        const storedToken = await AsyncStorage.getItem('token');
        if (storedToken) {
          config.headers = config.headers || {};
          config.headers['Authorization'] = `Bearer ${storedToken}`;
        }
        return config;
      },
      (error: AxiosError) => {
        return Promise.reject(error);
      },
    );

    // Add a response interceptor to handle token errors
    this.axiosInstance.interceptors.response.use(
      (response: AxiosResponse) => response,
      (error: AxiosError<ErrorResponse>) => {
        if (error.response) {
          const {status, data} = error.response;

          // Handle token-related errors from JWT middleware
          if (
            status === 401 &&
            (data?.errors?.[0]?.msg === 'No token provided' ||
              data?.errors?.[0]?.msg === 'Invalid token.' ||
              data?.errors?.[0]?.msg === 'Invalid token')
          ) {
            console.log('Token error detected:', data?.errors?.[0]?.msg);
            this.handleTokenError();
          }

          // Handle date mismatch error
          if (
            data?.errors?.[0]?.msg ===
            'Client date is more than 1 day different from server date'
          ) {
            console.log('Date mismatch error detected');
            this.handleDateMismatchError();
          }
        }
        return Promise.reject(error);
      },
    );
  }

  /**
   * Initialize token from AsyncStorage
   */
  private async initializeToken() {
    try {
      const storedToken = await AsyncStorage.getItem('token');
      this.token = storedToken;
    } catch (error) {
      console.error('Error initializing token:', error);
    }
  }

  /**
   * Gets the current date formatted as MM-DD-YYYY using Moment.js
   * @returns string - Date in MM-DD-YYYY format
   */
  private getFormattedDate(): string {
    return moment().format('MM-DD-YYYY');
  }

  /**
   * Sets the Bearer token to be used in subsequent API calls.
   * @param token - The Bearer token string.
   */
  public async setToken(token: string): Promise<void> {
    this.token = token;
    try {
      await AsyncStorage.setItem('token', token);
    } catch (error) {
      console.error('Error saving token:', error);
    }
  }

  /**
   * Clears the Bearer token and logs out the user.
   */
  public async clearToken(): Promise<void> {
    this.token = null;
    try {
      await AsyncStorage.multiRemove(['token', 'user']);
      // You'll need to implement navigation to login screen
      // This depends on your navigation setup
      // Example: navigation.navigate('Login');
    } catch (error) {
      console.error('Error clearing token:', error);
    }
  }

  /**
   * Handles token-related errors by logging out the user.
   */
  private handleTokenError(): void {
    this.clearToken();
  }

  /**
   * Handles date mismatch errors by showing an alert and logging out the user.
   */
  private handleDateMismatchError(): void {
    Alert.alert(
      'Date Error',
      'Your device date is not synchronized with the server. Please update your device date and time settings.',
      [
        {
          text: 'OK',
          onPress: () => this.clearToken(),
        },
      ],
    );
  }

  /**
   * Performs an API call with the given configuration.
   * @param config - Axios request configuration.
   * @returns The response data.
   */
  public async performApiCall<T>(config: AxiosRequestConfig): Promise<T> {
    try {
      const response: AxiosResponse<T> = await this.axiosInstance.request<T>(
        config,
      );
      return response.data;
    } catch (error: any) {
      console.log('error', error);
      // Handle errors (you can customize this as needed)
      if (error.response) {
        // Server responded with a status other than 2xx
        throw new Error(
          error.response.data.error ||
            'API call failed with an unexpected error.',
        );
      } else if (error.request) {
        // No response received
        throw new Error('No response received from the API.');
      } else {
        // Other errors
        throw new Error(error.message || 'An unexpected error occurred.');
      }
    }
  }

  /**
   * Convenience method for GET requests.
   * @param endpoint - API endpoint.
   * @param params - Query parameters.
   * @returns The response data.
   */
  public async get<T>(endpoint: string, params?: any): Promise<T> {
    const config: AxiosRequestConfig = {
      method: 'GET',
      url: endpoint,
      params,
    };
    return this.performApiCall<T>(config);
  }

  /**
   * Convenience method for POST requests.
   * @param endpoint - API endpoint.
   * @param data - Request payload.
   * @returns The response data.
   */
  public async post<T>(endpoint: string, data: any): Promise<T> {
    const config: AxiosRequestConfig = {
      method: 'POST',
      url: endpoint,
      data,
    };
    return this.performApiCall<T>(config);
  }

  /**
   * Convenience method for PUT requests.
   * @param endpoint - API endpoint.
   * @param data - Request payload.
   * @returns The response data.
   */
  public async put<T>(endpoint: string, data: any): Promise<T> {
    const config: AxiosRequestConfig = {
      method: 'PUT',
      url: endpoint,
      data,
    };
    return this.performApiCall<T>(config);
  }

  /**
   * Convenience method for DELETE requests.
   * @param endpoint - API endpoint.
   * @param params - Query parameters.
   * @returns The response data.
   */
  public async delete<T>(endpoint: string, params?: any): Promise<T> {
    const config: AxiosRequestConfig = {
      method: 'DELETE',
      url: endpoint,
      params,
    };
    return this.performApiCall<T>(config);
  }

  /**
   * Handles streaming responses from the API
   * @param endpoint - API endpoint
   * @param data - Request payload
   * @param onData - Callback function to handle each chunk of data
   * @returns Promise that resolves when the stream is complete
   */
  public async stream<T>(
    endpoint: string,
    data: any,
    onData: (data: T) => void,
  ): Promise<void> {
    try {
      const response = await fetch(`${process.env.API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.token}`,
          'x-client-time': this.getFormattedDate(),
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (reader) {
        const {value, done} = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, {stream: true});
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.substring(6);
            if (data === '[DONE]') break;

            try {
              const parsed = JSON.parse(data) as T;
              onData(parsed);
            } catch (e) {
              console.error('Error parsing JSON:', e, data);
            }
          }
        }
      }
    } catch (error) {
      console.error('Streaming error:', error);
      throw error;
    }
  }
}

// Export a singleton instance
const apiService = new ApiService();
export default apiService;
