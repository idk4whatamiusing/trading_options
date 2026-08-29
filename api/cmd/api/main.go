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

	"github.com/99designs/gqlgen/graphql/handler"
	"github.com/99designs/gqlgen/graphql/handler/transport"
	"github.com/99designs/gqlgen/graphql/playground"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/cors"
	"github.com/idk4whatamiusing/meridian_stack/api/graph"
	"github.com/idk4whatamiusing/meridian_stack/api/internal/clients"
	"github.com/idk4whatamiusing/meridian_stack/api/internal/hub"
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

	srv := handler.NewDefaultServer(graph.NewExecutableSchema(graph.Config{Resolvers: resolver}))
	srv.AddTransport(&transport.Websocket{})

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
