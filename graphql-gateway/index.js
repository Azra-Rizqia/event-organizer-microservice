import { ApolloServer } from "@apollo/server";
import { startStandaloneServer } from "@apollo/server/standalone";

const PORT = Number(process.env.PORT || 4000);
const USER_SERVICE_URL = process.env.USER_SERVICE_URL || "http://user-service:3001";
const EVENT_SERVICE_URL = process.env.EVENT_SERVICE_URL || "http://event-service:8000";
const TIKET_SERVICE_URL = process.env.TIKET_SERVICE_URL || "http://tiket-service:3002";
const TRANSAKSI_SERVICE_URL = process.env.TRANSAKSI_SERVICE_URL || "http://transaksi-service:5000";

// HELPER
async function fetchJson(url, options = {}) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || `Request gagal ke ${url}`);
  return data;
}

// Normalize MongoDB _id -> id
function normalizeTiket(t) {
  return {
    id: t._id || t.id,
    user_id: t.user_id,
    event_id: t.event_id,
    quantity: t.quantity,
    harga_per_tiket: t.harga_per_tiket,
    total_harga: t.total_harga,
    status: t.status,
    user_snapshot: t.user_snapshot,
    event_snapshot: t.event_snapshot,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt
  };
}

// ===================== SCHEMA =====================
const typeDefs = `#graphql

  # ---- USER ----
  type User {
    id: ID!
    name: String
    email: String
    role: String
  }

  # ---- EVENT ----
  type Event {
    id: ID!
    name: String
    description: String
    location: String
    date: String
    capacity: Int
  }

  # ---- TIKET ----
  type UserSnapshot {
    id: Int
    name: String
    email: String
  }

  type EventSnapshot {
    id: Int
    name: String
    location: String
    date: String
    capacity: Int
  }

  type Tiket {
    id: ID!
    user_id: Int
    event_id: Int
    quantity: Int
    harga_per_tiket: Int
    total_harga: Int
    status: String
    user_snapshot: UserSnapshot
    event_snapshot: EventSnapshot
    # Resolver field: ambil data live dari service lain
    user: User
    event: Event
    createdAt: String
    updatedAt: String
  }

  # ---- TRANSAKSI ----
  type TiketSnapshot {
    tiket_id: String
    user_snapshot: UserSnapshot
    event_snapshot: EventSnapshot
    quantity: Int
    harga_per_tiket: Float
    total_harga: Float
  }

  type Transaksi {
    id: ID!
    tiket_id: String
    user_id: Int
    event_id: Int
    jumlah_bayar: Float
    metode_pembayaran: String
    status: String
    tiket_snapshot: TiketSnapshot
    # Resolver field
    tiket: Tiket
    created_at: String
    updated_at: String
  }

  # ---- SYSTEM ----
  type ServiceHealth {
    service: String
    database: String
    language: String
    framework: String
    status: String
  }

  type SystemStatus {
    user_service: ServiceHealth
    event_service: ServiceHealth
    tiket_service: ServiceHealth
    transaksi_service: ServiceHealth
  }

  # ---- QUERIES ----
  type Query {
    # Users
    users: [User]
    user(id: ID!): User

    # Events
    events: [Event]
    event(id: ID!): Event

    # Tikets
    tikets: [Tiket]
    tiket(id: ID!): Tiket
    tiketsByUser(user_id: Int!): [Tiket]
    tiketsByEvent(event_id: Int!): [Tiket]

    # Transaksi
    transaksiList: [Transaksi]
    transaksi(id: ID!): Transaksi
    transaksiByUser(user_id: Int!): [Transaksi]

    # System
    systemStatus: SystemStatus
  }

  # ---- MUTATIONS ----
  type Mutation {
    # User
    createUser(name: String!, email: String!, role: String): User
    updateUser(id: ID!, name: String, email: String, role: String): User
    deleteUser(id: ID!): Boolean

    # Event
    createEvent(name: String!, description: String!, location: String!, date: String!, capacity: Int!): Event
    updateEvent(id: ID!, name: String, description: String, location: String, date: String, capacity: Int): Event
    deleteEvent(id: ID!): Boolean

    # Tiket
    createTiket(user_id: Int!, event_id: Int!, quantity: Int!, harga_per_tiket: Int!): Tiket
    updateTiketStatus(id: ID!, status: String!): Tiket
    deleteTiket(id: ID!): Boolean

    # Transaksi
    createTransaksi(tiket_id: String!, metode_pembayaran: String): Transaksi
    updateTransaksiStatus(id: ID!, status: String!): Transaksi
  }
`;

// RESOLVERS
const resolvers = {
  Query: {
    // --- USERS ---
    users: async () => {
      const data = await fetchJson(`${USER_SERVICE_URL}/users`);
      return data;
    },
    user: async (_, { id }) => {
      return await fetchJson(`${USER_SERVICE_URL}/users/${id}`);
    },

    // --- EVENTS ---
    events: async () => {
      const data = await fetchJson(`${EVENT_SERVICE_URL}/api/events`);
      // Laravel bisa return array langsung atau {data: [...]}
      return Array.isArray(data) ? data : data.data;
    },
    event: async (_, { id }) => {
      const data = await fetchJson(`${EVENT_SERVICE_URL}/api/events/${id}`);
      return data.data || data;
    },

    // --- TIKETS ---
    tikets: async () => {
      const data = await fetchJson(`${TIKET_SERVICE_URL}/tikets`);
      return data.data.map(normalizeTiket);
    },
    tiket: async (_, { id }) => {
      const data = await fetchJson(`${TIKET_SERVICE_URL}/tikets/${id}`);
      return normalizeTiket(data.data);
    },
    tiketsByUser: async (_, { user_id }) => {
      const data = await fetchJson(`${TIKET_SERVICE_URL}/tikets/user/${user_id}`);
      return data.data.map(normalizeTiket);
    },
    tiketsByEvent: async (_, { event_id }) => {
      const data = await fetchJson(`${TIKET_SERVICE_URL}/tikets/event/${event_id}`);
      return data.data.map(normalizeTiket);
    },

    // --- TRANSAKSI ---
    transaksiList: async () => {
      const data = await fetchJson(`${TRANSAKSI_SERVICE_URL}/transaksi`);
      return data.data;
    },
    transaksi: async (_, { id }) => {
      const data = await fetchJson(`${TRANSAKSI_SERVICE_URL}/transaksi/${id}`);
      return data.data;
    },
    transaksiByUser: async (_, { user_id }) => {
      const data = await fetchJson(`${TRANSAKSI_SERVICE_URL}/transaksi/user/${user_id}`);
      return data.data;
    },

    // --- SYSTEM STATUS ---
    systemStatus: async () => {
      const [userHealth, tiketHealth, transaksiHealth] = await Promise.all([
        fetchJson(`${USER_SERVICE_URL}/health`),
        fetchJson(`${TIKET_SERVICE_URL}/health`),
        fetchJson(`${TRANSAKSI_SERVICE_URL}/health`)
      ]);

      // event-service Laravel health check
      let eventHealth = { service: "event-service", status: "unknown" };
      try {
        eventHealth = await fetchJson(`${EVENT_SERVICE_URL}/api/health`);
      } catch {
        eventHealth = { service: "event-service", status: "error" };
      }

      return {
        user_service: userHealth,
        event_service: eventHealth,
        tiket_service: tiketHealth,
        transaksi_service: transaksiHealth
      };
    }
  },

  // ---- FIELD RESOLVERS (data live dari service lain) ----
  Tiket: {
    // Ambil data user live dari user-service
    user: async (tiket) => {
      if (!tiket.user_id) return null;
      try {
        return await fetchJson(`${USER_SERVICE_URL}/users/${tiket.user_id}`);
      } catch {
        return null;
      }
    },
    // Ambil data event live dari event-service
    event: async (tiket) => {
      if (!tiket.event_id) return null;
      try {
        const data = await fetchJson(`${EVENT_SERVICE_URL}/api/events/${tiket.event_id}`);
        return data.data || data;
      } catch {
        return null;
      }
    }
  },

  Transaksi: {
    // Ambil data tiket live dari tiket-service
    tiket: async (transaksi) => {
      if (!transaksi.tiket_id) return null;
      try {
        const data = await fetchJson(`${TIKET_SERVICE_URL}/tikets/${transaksi.tiket_id}`);
        return normalizeTiket(data.data);
      } catch {
        return null;
      }
    }
  },

  Mutation: {
    // --- USER ---
    createUser: async (_, args) => {
      return await fetchJson(`${USER_SERVICE_URL}/users`, {
        method: "POST",
        body: JSON.stringify(args)
      });
    },
    updateUser: async (_, { id, ...args }) => {
      return await fetchJson(`${USER_SERVICE_URL}/users/${id}`, {
        method: "PATCH",
        body: JSON.stringify(args)
      });
    },
    deleteUser: async (_, { id }) => {
      await fetchJson(`${USER_SERVICE_URL}/users/${id}`, { method: "DELETE" });
      return true;
    },

    // --- EVENT ---
    createEvent: async (_, args) => {
      const data = await fetchJson(`${EVENT_SERVICE_URL}/api/events`, {
        method: "POST",
        body: JSON.stringify(args)
      });
      return data.data || data;
    },
    updateEvent: async (_, { id, ...args }) => {
      const data = await fetchJson(`${EVENT_SERVICE_URL}/api/events/${id}`, {
        method: "PUT",
        body: JSON.stringify(args)
      });
      return data.data || data;
    },
    deleteEvent: async (_, { id }) => {
      await fetchJson(`${EVENT_SERVICE_URL}/api/events/${id}`, { method: "DELETE" });
      return true;
    },

    // --- TIKET ---
    createTiket: async (_, args) => {
      const data = await fetchJson(`${TIKET_SERVICE_URL}/tikets`, {
        method: "POST",
        body: JSON.stringify(args)
      });
      return normalizeTiket(data.data);
    },
    updateTiketStatus: async (_, { id, status }) => {
      const data = await fetchJson(`${TIKET_SERVICE_URL}/tikets/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status })
      });
      return normalizeTiket(data.data);
    },
    deleteTiket: async (_, { id }) => {
      await fetchJson(`${TIKET_SERVICE_URL}/tikets/${id}`, { method: "DELETE" });
      return true;
    },

    // --- TRANSAKSI ---
    createTransaksi: async (_, args) => {
      const data = await fetchJson(`${TRANSAKSI_SERVICE_URL}/transaksi`, {
        method: "POST",
        body: JSON.stringify(args)
      });
      return data.data;
    },
    updateTransaksiStatus: async (_, { id, status }) => {
      const data = await fetchJson(`${TRANSAKSI_SERVICE_URL}/transaksi/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status })
      });
      return data.data;
    }
  }
};

// START
const server = new ApolloServer({ typeDefs, resolvers });

const { url } = await startStandaloneServer(server, {
  listen: { host: "0.0.0.0", port: PORT }
});

console.log(`GraphQL Gateway berjalan pada ${url}`);