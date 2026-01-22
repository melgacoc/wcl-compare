import { ApolloClient, InMemoryCache, createHttpLink } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';

const httpLink = createHttpLink({
  uri: 'https://www.warcraftlogs.com/api/v2/client',
});

const authLink = setContext((_, { headers }) => {
  const token = localStorage.getItem('wcl_token');
  return {
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : '',
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