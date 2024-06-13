"use client";

import Post from "@/components/Post";
import Spinner from "@/components/Spinner";
import { domains } from "@/utils/fetch";
import { GetMessage, Returns } from "@/types/returnTypes";
import { notFound } from "next/navigation";
import { FC } from "react";
import { useMutation, useQuery } from "react-query";

const MessageView: FC<{ message: GetMessage }> = ({
  message: { message, user },
}) => {
  return (
    <div>
      <div style={{ fontWeight: "600" }}>
        {user.handle} - {message.created.toString()}
      </div>
      <div>{message.text}</div>
    </div>
  );
};

const PlaceView: FC<{ placeDetails: Returns.PlaceDetails }> = ({
  placeDetails,
}) => {
  return (
    <div>
      <div>
        {placeDetails.place.name} - {placeDetails.place.internalStatus}
      </div>

      {placeDetails.paragraphs.map(({ paragraph, sources }) => (
        <div key={paragraph.id}>
          <p>{paragraph.text}</p>
          <div style={{ display: "flex", gap: 10 }}>
            {sources.map((source, index) => (
              <a key={source.id} href={source.url}>
                source {index + 1}
              </a>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

const Component: FC<{ placeId: number }> = ({ placeId }) => {
  const placeData = useQuery({
    queryFn: () => domains.public.get.place({ placeId }),
    queryKey: ["place", placeId],
  });

  return (
    <div>
      {placeData.isLoading ? (
        <Spinner />
      ) : placeData.isSuccess ? (
        placeData.data ? (
          <PlaceView placeDetails={placeData.data} />
        ) : (
          notFound()
        )
      ) : null}
    </div>
  );
};

export default Component;
