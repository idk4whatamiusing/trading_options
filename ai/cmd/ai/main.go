package main

import (
	"context"
	"log"
	"net"
	"net/http"
	"os"

	"github.com/idk4whatamiusing/meridian_stack/ai/internal/brain"
	aipb "github.com/idk4whatamiusing/meridian_stack/api/pb/aipb"
	"google.golang.org/grpc"
	"google.golang.org/grpc/health"
	healthpb "google.golang.org/grpc/health/grpc_health_v1"
)

type server struct {
	aipb.UnimplementedAiServer
	brain *brain.Client
}

func envOr(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}

func (s *server) RunCycle(ctx context.Context, req *aipb.RunCycleRequest) (*aipb.RunCycleReply, error) {
	cycleID, status, err := s.brain.RunCycle(req.GetTickers())
	if err != nil {
		return nil, err
	}
	return &aipb.RunCycleReply{CycleId: cycleID, Status: status}, nil
}

func (s *server) GetLastCycleResult(ctx context.Context, req *aipb.GetLastCycleResultRequest) (*aipb.CycleResult, error) {
	r, err := s.brain.LastCycle()
	if err != nil {
		return nil, err
	}
	return &aipb.CycleResult{
		CycleId:          r.CycleID,
		StartedAt:        r.StartedAt,
		FinishedAt:       r.FinishedAt,
		TickersEvaluated: r.TickersEvaluated,
		TradesProposed:   r.TradesProposed,
		TradesPlaced:     r.TradesPlaced,
		TradesBlocked:    r.TradesBlocked,
		Errors:           r.Errors,
		Status:           r.Status,
	}, nil
}

func main() {
	go func() { // plain-HTTP health for compose probes
		mux := http.NewServeMux()
		mux.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) { w.Write([]byte("ok")) })
		_ = http.ListenAndServe(":8081", mux)
	}()

	grpcAddr := envOr("AI_GRPC_LISTEN", ":8002")
	lis, err := net.Listen("tcp", grpcAddr)
	if err != nil {
		log.Fatal(err)
	}
	brainURL := envOr("BRAIN_URL", "http://localhost:8003")
	log.Printf("ai gRPC listening on %s (trading brain: %s)", grpcAddr, brainURL)

	s := &server{brain: brain.New(brainURL)}
	gs := grpc.NewServer()
	aipb.RegisterAiServer(gs, s)
	hs := health.NewServer()
	hs.SetServingStatus("", healthpb.HealthCheckResponse_SERVING)
	healthpb.RegisterHealthServer(gs, hs)
	if err := gs.Serve(lis); err != nil {
		log.Fatal(err)
	}
}
