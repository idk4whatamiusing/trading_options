// Meridian api - the public Go service.
// Browser talks GraphQL here (raw fetch + graphql-ws); this service fans
// gRPC calls out to db (Rust) and ai (Go, proxying the Python trading
// brain), and notifies realtime (Gleam) over its /broadcast hook.
// No auth: single-user hackathon demo.
package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/99designs/gqlgen/graphql/handler"
	"github.com/99designs/gqlgen/graphql/handler/extension"
	"github.com/99designs/gqlgen/graphql/handler/lru"
	"github.com/99designs/gqlgen/graphql/handler/transport"
	"github.com/99designs/gqlgen/graphql/playground"
	"github.com/coder/websocket"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/cors"
	"github.com/idk4whatamiusing/meridian_stack/api/graph"
	"github.com/idk4whatamiusing/meridian_stack/api/internal/clients"
	"github.com/idk4whatamiusing/meridian_stack/api/internal/hub"
	"github.com/vektah/gqlparser/v2/ast"
)

func envOr(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}

func main() {
	ctx := context.Background()
	port := envOr("PORT", "8000")
	secret := envOr("BACKEND_SECRET", "change-me")

	cl, err := clients.New(ctx, clients.Config{
		DBAddr:      envOr("DB_GRPC_ADDR", "localhost:8010"),
		RealtimeURL: envOr("REALTIME_URL", "http://localhost:8001"),
		AiAddr:      envOr("AI_GRPC_ADDR", "localhost:8002"),
		Secret:      secret,
	})
	if err != nil {
		log.Fatalf("grpc dial: %v", err)
	}
	hb := hub.New(256)

	resolver := &graph.Resolver{Clients: cl, Hub: hb}

	// Replicates handler.NewDefaultServer, except for the Websocket transport:
	// AddTransport picks the *first* matching transport and NewDefaultServer
	// already registers a same-origin-only Websocket transport, so appending
	// a second, permissive one after it via AddTransport has no effect - the
	// strict one still wins and silently closes the connection (code 1006).
	// The dashboard is on a different origin from the API in every real
	// deployment (different dev port locally; Cloudflare UI vs AWS API in
	// prod), and there's no session/cookie riding on this connection (no
	// auth at all - single-user demo), so skip the origin check entirely.
	srv := handler.New(graph.NewExecutableSchema(graph.Config{Resolvers: resolver}))
	srv.AddTransport(&transport.Websocket{
		KeepAlivePingInterval: 10 * time.Second,
		Implementation: transport.CoderWebsocketImplementation{
			AcceptOptions: websocket.AcceptOptions{InsecureSkipVerify: true},
		},
	})
	srv.AddTransport(transport.Options{})
	srv.AddTransport(transport.GET{})
	srv.AddTransport(transport.POST{})
	srv.AddTransport(transport.MultipartForm{})
	srv.SetQueryCache(lru.New[*ast.QueryDocument](1000))
	srv.Use(extension.Introspection{})
	srv.Use(extension.AutomaticPersistedQuery{Cache: lru.New[string](100)})

	r := chi.NewRouter()
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"https://*", "http://*"},
		AllowedMethods:   []string{"GET", "POST", "OPTIONS"},
		AllowedHeaders:   []string{"Content-Type", "x-backend-secret"},
		AllowCredentials: true,
	}))

	r.Get("/api/health", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"status":"ok"}`))
	})
	r.Handle("/api/graphql", srv)
	r.Get("/api/graphql/playground", playground.Handler("Meridian", "/api/graphql"))

	log.Printf("api listening on :%s", port)
	if err := http.ListenAndServe(":"+port, r); err != nil {
		log.Fatal(err)
	}
}
