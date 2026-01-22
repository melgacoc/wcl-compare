import { ApolloClient, InMemoryCache, createHttpLink } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';

// Token fixo para teste de deploy
const TOKEN = "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJhdWQiOiJhMGU2NTVkOS00NWUyLTQ5YzItOGIyOS0yNmFjMzIzNjVhYjAiLCJqdGkiOiI2MTc2ZDlhNzEyZjk2NDliYTYxZWFjYmVkNDZlMjhmYzc0MThmNWNkMmNiZWEwNTRlOTllMzFhMjRiNDUyNzJjMzg0ODJjYTUzODM1ZWM1YyIsImlhdCI6MTc2OTExMTUyMy44NzIyODQsIm5iZiI6MTc2OTExMTUyMy44NzIyODYsImV4cCI6MTgwMDIxNTUyMy44NjM2ODUsInN1YiI6IiIsInNjb3BlcyI6WyJ2aWV3LXVzZXItcHJvZmlsZSIsInZpZXctcHJpdmF0ZS1yZXBvcnRzIl19.tOUBbGx3g2UnElUBLyL_vyM1gVI64XvUpIYalF9_1seB0NOaNo6jWFQjEWPTxrsEPr3JoUa-DBIJ4VuZJqPwM79AZWZfAEUGZJQatMGWs9jJd2HVQ3Xd2b4hxG2G_3RSTQz0QQZZyJYp-CTAKx1SczaSoOT-ufcLt6vv7sknA67Ik0DVMJviNYYI_k-hLQULmY0z_0Wef2Qd7PDkqXjq_ggjSHbe6bMV4QtO6l2kZzUlQzir1CbaNnXJvtnAYwKzexa9s1iLVL5_I0LrGB2U0NINZxDpBaZLZCdWmy6pJyL52cRd-eFYzwiVuyFOC5W2RDzC-VnEFe7GgPjdokscQN9iPzUzusbAApE1UxwpPWVBcplZw5xfDWmZhf5zJei_YimPuRfZNf5_S5pyLcm0MlMGixBc3ZD_PT8iEJjk1C0P5eEnsbmgWU02YJ-6z_EspjibjlUF0SVTIYSHt2vU7VmG-1jKH13De7H5RTCrHf2ofhT-U7SnUsLyqSt3hcWfT5o9EzoXpBKbYocmHT17own4aNWZzutZh5Lmkf-AKT40nBae-r5TzG0yjAXgnzU30WfO2ILs5IDQNZdd0YS_R0bXK9Iwc80M3A_5yrhl1X8GvzvB493HtONldGgzupE4xC_TzGOqCQFkmP_LjZ6OuzMHZmPUYU7UuC3ndrbPRAs";

const httpLink = createHttpLink({
  uri: 'https://www.warcraftlogs.com/api/v2/client',
});

const authLink = setContext((_, { headers }) => {
  return {
    headers: {
      ...headers,
      authorization: `Bearer ${TOKEN}`,
    }
  }
});

export const client = new ApolloClient({
  link: authLink.concat(httpLink),
  cache: new InMemoryCache({
    typePolicies: {
      Query: {
        fields: {
          reportData: {
            merge(existing, incoming) {
              return incoming;
            },
          },
        },
      },
    },
  }),
});