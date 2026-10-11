import update from "immutability-helper";
import { useCallback } from "react";
import Card from "./Card";
const Base_URL = import.meta.env.VITE_APP_API_SOCKET_URL;

const Container = ({ setImageUrl, imageUrl, handleRemoveImage }) => {
  const moveCard = useCallback(
    (dragIndex, hoverIndex) => {
      setImageUrl((prevCards) =>
        update(prevCards, {
          $splice: [
            [dragIndex, 1],
            [hoverIndex, 0, prevCards[dragIndex]],
          ],
        })
      );
    },
    [setImageUrl]
  );

  const renderCard = useCallback(
    (card) => {
      return (
        <Card
          key={1}
          index={1}
          id={card.id}
          text={card.text}
          moveCard={moveCard}
          image={`${Base_URL}${card}`}
          handleRemoveImage={handleRemoveImage}
        />
      );
    },
    [moveCard, handleRemoveImage]
  );
  return <>{renderCard(imageUrl)}</>;
};

export default Container;
