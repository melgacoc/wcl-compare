import { ApolloClient, InMemoryCache, createHttpLink } from '@apollo/client';

// O token OAuth é obtido no servidor (/api/wcl); nenhum segredo vai para o navegador.
const httpLink = createHttpLink({
  uri: '/api/wcl',
});

export const client = new ApolloClient({
  link: httpLink,
  cache: new InMemoryCache({
    typePolicies: {
      Query: {
        fields: {
          reportData: {
            merge(_, incoming) {
              return incoming;
            },
          },
        },
      },
    },
  }),
});
